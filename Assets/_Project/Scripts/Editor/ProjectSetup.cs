using System.Collections.Generic;
using System.IO;
using EmpireTycoon.Runtime.Bootstrap;
using EmpireTycoon.Runtime.Data;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.SceneManagement;

namespace EmpireTycoon.EditorTools
{
    /// <summary>
    /// Configuração automática e idempotente do projeto:
    /// URP (3 presets de qualidade), material-modelo, cena na build e Player Settings do Android.
    /// Roda sozinha na primeira abertura do projeto e pode ser repetida pelo menu.
    /// </summary>
    [InitializeOnLoad]
    public static class ProjectSetup
    {
        public const string SettingsFolder = "Assets/_Project/Settings";
        public const string MainScenePath = "Assets/_Project/Scenes/Main.unity";
        public const string DatabasePath = "Assets/_Project/Resources/GameDatabase.asset";
        public const string MaterialTemplatePath = SettingsFolder + "/M_LitTemplate.mat";
        public const string DefaultApplicationId = "com.empiretycoon.game";

        private static readonly string[] PresetNames = { "Low", "Medium", "High" };

        static ProjectSetup()
        {
            EditorApplication.delayCall += AutoSetupIfNeeded;
        }

        private static void AutoSetupIfNeeded()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode) return;
            if (!NeedsSetup()) return;
            Debug.Log("[EmpireTycoon] Primeira abertura detectada: configurando URP, qualidade, cena e Android...");
            Run(verbose: false);
        }

        public static bool NeedsSetup()
        {
            if (GraphicsSettings.defaultRenderPipeline == null) return true;
            var db = AssetDatabase.LoadAssetAtPath<GameDatabase>(DatabasePath);
            if (db != null && db.litMaterialTemplate == null) return true;
            foreach (var s in EditorBuildSettings.scenes) if (s.path == MainScenePath) return false;
            return true;
        }

        [MenuItem("Empire Tycoon/Configurar Projeto (URP, Qualidade, Android)", priority = 0)]
        public static void RunFromMenu()
        {
            Run(verbose: true);
            EditorUtility.DisplayDialog("Empire Tycoon", "Projeto configurado:\n• URP com presets Low/Medium/High\n• Material-modelo\n• Cena Main na build\n• Player Settings do Android", "OK");
        }

        public static void Run(bool verbose)
        {
            EnsureFolder(SettingsFolder);

            var low = CreateOrUpdatePipeline("Low", renderScale: 0.8f, msaa: 1, shadowDistance: 70f, shadowResolution: 1024, cascades: 1, softShadows: false);
            var medium = CreateOrUpdatePipeline("Medium", renderScale: 1f, msaa: 2, shadowDistance: 110f, shadowResolution: 2048, cascades: 1, softShadows: true);
            var high = CreateOrUpdatePipeline("High", renderScale: 1f, msaa: 4, shadowDistance: 170f, shadowResolution: 2048, cascades: 2, softShadows: true);

            GraphicsSettings.defaultRenderPipeline = medium;
            ConfigureQualityLevels(new[] { low, medium, high });

            var template = EnsureMaterialTemplate();
            var db = AssetDatabase.LoadAssetAtPath<GameDatabase>(DatabasePath);
            if (db != null && template != null && db.litMaterialTemplate != template)
            {
                db.litMaterialTemplate = template;
                EditorUtility.SetDirty(db);
            }

            if (!File.Exists(MainScenePath)) CreateMainScene();
            EnsureSceneInBuild(MainScenePath);
            ConfigurePlayerSettings();

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            if (verbose) Debug.Log("[EmpireTycoon] Configuração do projeto concluída.");
        }

        // ------------------------------------------------------------------ URP

        private static UniversalRenderPipelineAsset CreateOrUpdatePipeline(string name, float renderScale, int msaa, float shadowDistance, int shadowResolution, int cascades, bool softShadows)
        {
            string assetPath = SettingsFolder + "/URP_" + name + ".asset";
            string rendererPath = SettingsFolder + "/URP_" + name + "_Renderer.asset";

            var asset = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(assetPath);
            if (asset == null)
            {
                var renderer = AssetDatabase.LoadAssetAtPath<UniversalRendererData>(rendererPath);
                if (renderer == null)
                {
                    renderer = ScriptableObject.CreateInstance<UniversalRendererData>();
                    AssetDatabase.CreateAsset(renderer, rendererPath);
                }
                asset = UniversalRenderPipelineAsset.Create(renderer);
                AssetDatabase.CreateAsset(asset, assetPath);
            }

            var so = new SerializedObject(asset);
            SetFloat(so, "m_RenderScale", renderScale);
            SetInt(so, "m_MSAA", msaa);
            SetFloat(so, "m_ShadowDistance", shadowDistance);
            SetInt(so, "m_MainLightShadowmapResolution", shadowResolution);
            SetInt(so, "m_ShadowCascadeCount", cascades);
            SetBool(so, "m_SoftShadowsSupported", softShadows);
            SetBool(so, "m_SupportsHDR", false);
            SetBool(so, "m_RequireDepthTexture", false);
            SetBool(so, "m_RequireOpaqueTexture", false);
            SetBool(so, "m_UseSRPBatcher", true);
            so.ApplyModifiedPropertiesWithoutUndo();
            EditorUtility.SetDirty(asset);
            return asset;
        }

        private static void ConfigureQualityLevels(UniversalRenderPipelineAsset[] pipelines)
        {
            var assets = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/QualitySettings.asset");
            if (assets == null || assets.Length == 0)
            {
                Debug.LogWarning("[EmpireTycoon] QualitySettings.asset não encontrado; configure os níveis manualmente.");
                return;
            }
            var so = new SerializedObject(assets[0]);
            var levels = so.FindProperty("m_QualitySettings");
            if (levels == null) return;
            levels.arraySize = PresetNames.Length;
            float[] lodBias = { 0.7f, 1f, 1.5f };
            for (int i = 0; i < PresetNames.Length; i++)
            {
                var level = levels.GetArrayElementAtIndex(i);
                SetRelative(level, "name", p => p.stringValue = PresetNames[i]);
                SetRelative(level, "customRenderPipeline", p => p.objectReferenceValue = pipelines[i]);
                SetRelative(level, "vSyncCount", p => p.intValue = 0);
                SetRelative(level, "lodBias", p => p.floatValue = lodBias[i]);
                SetRelative(level, "antiAliasing", p => p.intValue = 0);
                SetRelative(level, "realtimeReflectionProbes", p => p.boolValue = false);
                SetRelative(level, "softParticles", p => p.boolValue = false);
                SetRelative(level, "globalTextureMipmapLimit", p => p.intValue = i == 0 ? 1 : 0);
            }
            var current = so.FindProperty("m_CurrentQuality");
            if (current != null) current.intValue = 1;
            so.ApplyModifiedPropertiesWithoutUndo();
        }

        private static Material EnsureMaterialTemplate()
        {
            var mat = AssetDatabase.LoadAssetAtPath<Material>(MaterialTemplatePath);
            if (mat != null) return mat;
            var shader = Shader.Find("Universal Render Pipeline/Simple Lit");
            if (shader == null) shader = Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null)
            {
                Debug.LogError("[EmpireTycoon] Shaders do URP não encontrados. Verifique se o pacote URP está instalado.");
                return null;
            }
            mat = new Material(shader) { name = "M_LitTemplate", enableInstancing = false };
            if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", Color.white);
            AssetDatabase.CreateAsset(mat, MaterialTemplatePath);
            return mat;
        }

        // ------------------------------------------------------------------ Cena e build

        [MenuItem("Empire Tycoon/Recriar Cena Principal", priority = 20)]
        public static void CreateMainScene()
        {
            EnsureFolder(Path.GetDirectoryName(MainScenePath).Replace('\\', '/'));
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var go = new GameObject("GameBootstrap");
            var bootstrap = go.AddComponent<GameBootstrap>();
            var so = new SerializedObject(bootstrap);
            var dbProp = so.FindProperty("database");
            if (dbProp != null) dbProp.objectReferenceValue = AssetDatabase.LoadAssetAtPath<GameDatabase>(DatabasePath);
            so.ApplyModifiedPropertiesWithoutUndo();
            EditorSceneManager.SaveScene(scene, MainScenePath);
            EnsureSceneInBuild(MainScenePath);
        }

        private static void EnsureSceneInBuild(string path)
        {
            var scenes = new List<EditorBuildSettingsScene>(EditorBuildSettings.scenes);
            scenes.RemoveAll(s => s.path == path);
            scenes.Insert(0, new EditorBuildSettingsScene(path, true));
            EditorBuildSettings.scenes = scenes.ToArray();
        }

        private static void ConfigurePlayerSettings()
        {
            PlayerSettings.companyName = "Empire Tycoon Studio";
            PlayerSettings.productName = "Empire Tycoon";
            if (string.IsNullOrEmpty(PlayerSettings.bundleVersion) || PlayerSettings.bundleVersion == "1.0")
                PlayerSettings.bundleVersion = "0.1.0";

            var android = NamedBuildTarget.Android;
            string currentId = PlayerSettings.GetApplicationIdentifier(android);
            if (string.IsNullOrEmpty(currentId) || currentId.Contains("DefaultCompany") || currentId.Contains("Template"))
                PlayerSettings.SetApplicationIdentifier(android, DefaultApplicationId);

            PlayerSettings.SetScriptingBackend(android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            if ((int)PlayerSettings.Android.minSdkVersion < 24) PlayerSettings.Android.minSdkVersion = (AndroidSdkVersions)24;
            PlayerSettings.colorSpace = ColorSpace.Linear;

            PlayerSettings.defaultInterfaceOrientation = UIOrientation.AutoRotation;
            PlayerSettings.allowedAutorotateToLandscapeLeft = true;
            PlayerSettings.allowedAutorotateToLandscapeRight = true;
            PlayerSettings.allowedAutorotateToPortrait = false;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            PlayerSettings.Android.renderOutsideSafeArea = true;
        }

        // ------------------------------------------------------------------ Utilitários

        public static void EnsureFolder(string path)
        {
            if (AssetDatabase.IsValidFolder(path)) return;
            string parent = Path.GetDirectoryName(path).Replace('\\', '/');
            if (!AssetDatabase.IsValidFolder(parent)) EnsureFolder(parent);
            AssetDatabase.CreateFolder(parent, Path.GetFileName(path));
        }

        private static void SetFloat(SerializedObject so, string prop, float v) { var p = so.FindProperty(prop); if (p != null) p.floatValue = v; else Missing(prop); }
        private static void SetInt(SerializedObject so, string prop, int v) { var p = so.FindProperty(prop); if (p != null) p.intValue = v; else Missing(prop); }
        private static void SetBool(SerializedObject so, string prop, bool v) { var p = so.FindProperty(prop); if (p != null) p.boolValue = v; else Missing(prop); }

        private static void SetRelative(SerializedProperty parent, string name, System.Action<SerializedProperty> set)
        {
            var p = parent.FindPropertyRelative(name);
            if (p != null) set(p);
        }

        private static void Missing(string prop) => Debug.LogWarning("[EmpireTycoon] Propriedade do URP não encontrada (versão diferente?): " + prop);
    }
}
