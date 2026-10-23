using UnityEngine;

namespace WarriorsOfPersia.CameraSystem
{
    /// <summary>
    /// دوربین سه‌بعدی Top-Down زاویه‌دار مخصوص بازی موبایل اکشن-ماجرایی Warriors of Persia
    /// </summary>
    public class TopDownCamera3D : MonoBehaviour
    {
        [Header("هدف دنبال‌شونده (Target Hero)")]
        public Transform target;

        [Header("تنظیمات زاویه و فاصله سه‌بعدی")]
        public Vector3 offset = new Vector3(0f, 34f, -26f);
        public float smoothSpeed = 8f;
        public float pitchAngle = 52f;

        private void LateUpdate()
        {
            if (target == null) return;

            Vector3 desiredPosition = target.position + offset;
            transform.position = Vector3.Lerp(transform.position, desiredPosition, smoothSpeed * Time.deltaTime);
            transform.rotation = Quaternion.Euler(pitchAngle, 0f, 0f);
        }
    }
}
