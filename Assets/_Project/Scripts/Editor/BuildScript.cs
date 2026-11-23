using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace EmpireTycoon.EditorTools
{
    /// <summary>
    /// Builds pelo menu ou pela linha de comando (CI):
    /// Unity -batchmode -quit -projectPath . -executeMethod EmpireTycoon.EditorTools.BuildScript.BuildAndroidDevelopment
    /// </summary>
    public static class BuildScript
    {
        [MenuItem("Empire Tycoon/Build/Android APK (desenvolvimento)", priority = 100)]
        public static void BuildAndroidDevelopment() => BuildAndroid(development: true, appBundle: false);

        [MenuItem("Empire Tycoon/Build/Android AAB (Google Play)", priority = 101)]
        public static void BuildAndroidRelease() => BuildAndroid(development: false, appBundle: true);

        [MenuItem("Empire Tycoon/Build/Desktop (plataforma do Editor)", priority = 110)]
        public static void BuildDesktop()
        {
            BuildTarget target;
            string file;
            switch (Application.platform)
            {
                case RuntimePlatform.WindowsEditor: target = BuildTarget.StandaloneWindows64; file = "EmpireTycoon.exe"; break;
                case RuntimePlatform.OSXEditor: target = BuildTarget.StandaloneOSX; file = "EmpireTycoon.app"; break;
                default: target = BuildTarget.StandaloneLinux64; file = "EmpireTycoon.x86_64"; break;
            }
            Build(target, BuildTargetGroup.Standalone, Path.Combine("Builds", "Desktop", file), BuildOptions.None);
        }

        private static void BuildAndroid(bool development, bool appBundle)
        {
            EditorUserBuildSettings.buildAppBundle = appBundle;
            string path = Path.Combine("Builds", "Android", appBundle ? "EmpireTycoon.aab" : "EmpireTycoon-dev.apk");
            Build(BuildTarget.Android, BuildTargetGroup.Android, path, development ? BuildOptions.Development : BuildOptions.None);
        }

        private static void Build(BuildTarget target, BuildTargetGroup group, string path, BuildOptions options)
        {
            ProjectSetup.Run(verbose: false);
            Directory.CreateDirectory(Path.GetDirectoryName(path));
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = new[] { ProjectSetup.MainScenePath },
                locationPathName = path,
                target = target,
                targetGroup = group,
                options = options,
            });

            var summary = report.summary;
            if (summary.result == BuildResult.Succeeded)
            {
                Debug.Log("[EmpireTycoon] Build concluída: " + path + " (" + (summary.totalSize / (1024 * 1024)) + " MB)");
            }
            else
            {
                Debug.LogError("[EmpireTycoon] Build falhou: " + summary.result + " — erros: " + summary.totalErrors);
                if (Application.isBatchMode) EditorApplication.Exit(1);
            }
        }
    }
}
