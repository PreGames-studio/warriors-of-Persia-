using UnityEngine;
using UnityEngine.EventSystems;

public enum MobileActionType
{
    Run,
    SwordAttack
}

/// <summary>Hold-to-run and tap-to-attack touch button.</summary>
public sealed class MobileActionButton : MonoBehaviour, IPointerDownHandler, IPointerUpHandler, IPointerExitHandler
{
    public MobileActionType actionType;
    public SwordsmanController hero;

    public void OnPointerDown(PointerEventData eventData)
    {
        if (hero == null)
            return;

        if (actionType == MobileActionType.Run)
            hero.SetRunHeld(true);
        else
            hero.Attack();
    }

    public void OnPointerUp(PointerEventData eventData)
    {
        Release();
    }

    public void OnPointerExit(PointerEventData eventData)
    {
        Release();
    }

    private void OnDisable()
    {
        Release();
    }

    private void Release()
    {
        if (actionType == MobileActionType.Run && hero != null)
            hero.SetRunHeld(false);
    }
}
