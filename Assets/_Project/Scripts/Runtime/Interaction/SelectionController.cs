using System;
using EmpireTycoon.Runtime.Rendering;
using UnityEngine;

namespace EmpireTycoon.Runtime.Interaction
{
    /// <summary>Seleção de terrenos por toque/clique. A seleção é estado de interface, não de simulação.</summary>
    public sealed class SelectionController
    {
        private readonly CityView _view;
        private readonly Camera _camera;

        public int SelectedLotId { get; private set; } = -1;

        public event Action<int> SelectionChanged;

        public SelectionController(CityView view, Camera camera)
        {
            _view = view;
            _camera = camera;
        }

        public void HandleTap(Vector2 screenPosition)
        {
            var lot = _view.PickLot(_camera.ScreenPointToRay(screenPosition));
            Select(lot != null ? lot.Id : -1);
        }

        public void Select(int lotId)
        {
            if (lotId == SelectedLotId) return;
            SelectedLotId = lotId;
            _view.SetSelectedLot(lotId);
            SelectionChanged?.Invoke(lotId);
        }
    }
}
