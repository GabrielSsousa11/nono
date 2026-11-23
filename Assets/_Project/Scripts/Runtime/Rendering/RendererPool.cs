using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace EmpireTycoon.Runtime.Rendering
{
    /// <summary>
    /// Pool de GameObjects com MeshFilter + MeshRenderer. A cidade troca modelos com frequência
    /// (obras, melhorias, crescimento); reaproveitar objetos evita alocações e picos de GC no celular.
    /// Objetos que não vieram do pool (ex.: prefabs do Blender) são destruídos normalmente.
    /// </summary>
    public sealed class RendererPool
    {
        private readonly Stack<PooledRenderer> _free = new Stack<PooledRenderer>();
        private readonly Transform _root;
        private readonly List<PooledRenderer> _scratch = new List<PooledRenderer>();

        public int FreeCount => _free.Count;
        public int CreatedCount { get; private set; }

        public RendererPool(Transform root)
        {
            _root = root;
        }

        public GameObject Get(string name, Transform parent, Mesh mesh, Material[] materials, ShadowCastingMode shadows)
        {
            PooledRenderer item;
            if (_free.Count > 0)
            {
                item = _free.Pop();
            }
            else
            {
                var go = new GameObject(name);
                item = go.AddComponent<PooledRenderer>();
                item.Filter = go.AddComponent<MeshFilter>();
                item.Renderer = go.AddComponent<MeshRenderer>();
                item.Renderer.lightProbeUsage = LightProbeUsage.Off;
                item.Renderer.reflectionProbeUsage = ReflectionProbeUsage.Off;
                CreatedCount++;
            }

            var t = item.transform;
            item.gameObject.name = name;
            t.SetParent(parent, false);
            t.localPosition = Vector3.zero;
            t.localRotation = Quaternion.identity;
            t.localScale = Vector3.one;
            item.Filter.sharedMesh = mesh;
            item.Renderer.sharedMaterials = materials;
            item.Renderer.shadowCastingMode = shadows;
            item.gameObject.SetActive(true);
            return item.gameObject;
        }

        /// <summary>Devolve ao pool todos os renderers da hierarquia e destrói o que não é do pool.</summary>
        public void Release(GameObject root)
        {
            if (root == null) return;
            _scratch.Clear();
            root.GetComponentsInChildren(true, _scratch);
            foreach (var item in _scratch)
            {
                item.gameObject.SetActive(false);
                item.transform.SetParent(_root, false);
                _free.Push(item);
            }
            // Se a raiz não era do pool (ex.: grupo de LOD ou prefab), destrói o que sobrou.
            if (root.GetComponent<PooledRenderer>() == null) Object.Destroy(root);
        }
    }
}
