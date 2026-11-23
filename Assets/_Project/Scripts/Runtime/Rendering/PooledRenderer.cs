using UnityEngine;

namespace EmpireTycoon.Runtime.Rendering
{
    /// <summary>Marca objetos que pertencem ao <see cref="RendererPool"/>.</summary>
    public sealed class PooledRenderer : MonoBehaviour
    {
        public MeshFilter Filter;
        public MeshRenderer Renderer;
    }
}
