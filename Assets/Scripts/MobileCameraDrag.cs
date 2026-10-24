using UnityEngine;
using UnityEngine.EventSystems;

/// <summary>Turns right-side touch drags into third-person camera movement.</summary>
public sealed class MobileCameraDrag : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
{
    public SwordsmanController hero;
    public float horizontalStartFraction = 0.38f;

    private int activePointer = int.MinValue;

    public void OnPointerDown(PointerEventData eventData)
    {
        activePointer = eventData.position.x >= Screen.width * horizontalStartFraction
            ? eventData.pointerId
            : int.MinValue;
    }

    public void OnPointerUp(PointerEventData eventData)
    {
        if (eventData.pointerId == activePointer)
            activePointer = int.MinValue;
    }

    public void OnDrag(PointerEventData eventData)
    {
        if (eventData.pointerId == activePointer && hero != null)
            hero.Look(eventData.delta);
    }
}
