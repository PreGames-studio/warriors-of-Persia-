using UnityEngine;

/// <summary>Temporary low-poly target for sword combat testing in the open field.</summary>
public sealed class TrainingDummy : MonoBehaviour
{
    public float maxHealth = 120f;
    private float health;
    private Renderer bodyRenderer;
    private Material bodyMaterial;
    private Material flashMaterial;
    private float flashTimer;

    private void Awake()
    {
        health = maxHealth;
        Transform body = transform.Find("Visual/Body");
        if (body != null)
        {
            bodyRenderer = body.GetComponent<Renderer>();
            if (bodyRenderer != null)
            {
                bodyMaterial = bodyRenderer.sharedMaterial;
                flashMaterial = new Material(bodyMaterial);
                flashMaterial.color = new Color(1f, 0.82f, 0.56f);
                flashMaterial.EnableKeyword("_EMISSION");
                flashMaterial.SetColor("_EmissionColor", new Color(1f, 0.28f, 0.06f));
            }
        }
    }

    public void TakeDamage(float amount)
    {
        if (amount <= 0f)
            return;

        health = Mathf.Max(0f, health - amount);
        flashTimer = 0.14f;
        if (health <= 0f)
        {
            health = maxHealth;
            transform.localScale = Vector3.one * 0.86f;
            Invoke(nameof(RestoreScale), 0.1f);
        }
    }

    private void Update()
    {
        if (flashTimer > 0f)
        {
            flashTimer -= Time.deltaTime;
            if (bodyRenderer != null && flashMaterial != null)
                bodyRenderer.sharedMaterial = flashMaterial;
        }
        else if (bodyRenderer != null && bodyMaterial != null)
        {
            bodyRenderer.sharedMaterial = bodyMaterial;
        }
    }

    private void RestoreScale()
    {
        transform.localScale = Vector3.one;
    }

    private void OnDestroy()
    {
        if (flashMaterial != null)
            Destroy(flashMaterial);
    }
}
