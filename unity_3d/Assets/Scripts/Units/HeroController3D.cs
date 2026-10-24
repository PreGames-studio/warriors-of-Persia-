using UnityEngine;

namespace WarriorsOfPersia.Units
{
    /// <summary>
    /// کنترلر سه‌بعدی قهرمان پارسی (پشتیبانی از جوی‌استیک لمسی موبایل + کیبورد + مهارت‌های چهارگانه)
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    public class HeroController3D : MonoBehaviour
    {
        [Header("مشخصات قهرمان (Hero Stats)")]
        public string heroName = "آرش (جنگجوی پارسی)";
        public int level = 1;
        public float maxHP = 500f;
        public float currentHP = 500f;
        public float maxMana = 200f;
        public float currentMana = 200f;
        public float moveSpeed = 16f;
        public float rotationSpeed = 14f;

        private CharacterController _controller;
        private Vector2 _joystickInput;

        private void Awake()
        {
            _controller = GetComponent<CharacterController>();
        }

        public void SetJoystickInput(Vector2 input)
        {
            _joystickInput = Vector2.ClampMagnitude(input, 1f);
        }

        private void Update()
        {
            float h = Mathf.Abs(_joystickInput.x) > 0.01f ? _joystickInput.x : Input.GetAxisRaw("Horizontal");
            float v = Mathf.Abs(_joystickInput.y) > 0.01f ? _joystickInput.y : Input.GetAxisRaw("Vertical");

            Vector3 moveDir = new Vector3(h, 0f, v).normalized;
            if (moveDir.sqrMagnitude > 0.01f)
            {
                _controller.Move(moveDir * (moveSpeed * Time.deltaTime));
                Quaternion targetRot = Quaternion.LookRotation(moveDir, Vector3.up);
                transform.rotation = Quaternion.Slerp(transform.rotation, targetRot, rotationSpeed * Time.deltaTime);
            }

            // اعمال جاذبه روی زمین سه‌بعدی
            if (!_controller.isGrounded)
            {
                _controller.Move(Vector3.down * (18f * Time.deltaTime));
            }
        }
    }
}
