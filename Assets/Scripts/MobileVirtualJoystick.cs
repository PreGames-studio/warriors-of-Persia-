using UnityEngine;
using UnityEngine.EventSystems;

/// <summary>Touch joystick with a safe-area-friendly, normalized movement vector.</summary>
public sealed class MobileVirtualJoystick : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
{
    [SerializeField] private RectTransform handle;
    [SerializeField, Range(20f, 120f)] private float movementRadius = 58f;

    public Vector2 Value { get; private set; }

    public void SetHandle(RectTransform target)
    {
        handle = target;
    }

    public void OnPointerDown(PointerEventData eventData)
    {
        OnDrag(eventData);
    }

    public void OnDrag(PointerEventData eventData)
    {
        RectTransform rect = transform as RectTransform;
        if (rect == null || handle == null)
            return;

        if (RectTransformUtility.ScreenPointToLocalPointInRectangle(
                rect, eventData.position, eventData.pressEventCamera, out Vector2 localPoint))
        {
            Value = Vector2.ClampMagnitude(localPoint / movementRadius, 1f);
            handle.anchoredPosition = Value * movementRadius;
        }
    }

    public void OnPointerUp(PointerEventData eventData)
    {
        Value = Vector2.zero;
        if (handle != null)
            handle.anchoredPosition = Vector2.zero;
    }
}
