using System;
using UnityEngine;

/// <summary>Mobile third-person movement, sprinting and a three-step sword combo.</summary>
[RequireComponent(typeof(CharacterController))]
public sealed class SwordsmanController : MonoBehaviour
{
    public event Action<float> SwordHit;

    [Header("Movement")]
    public float walkSpeed = 4.4f;
    public float runSpeed = 7.6f;
    public float acceleration = 19f;
    public float turnSpeed = 13f;
    public float gravity = 22f;

    [Header("Sword")]
    public float swordDamage = 34f;
    public float attackCooldown = 0.42f;
    public float attackDuration = 0.46f;
    public float attackReach = 1.25f;

    [Header("Camera")]
    public float cameraDistance = 4.8f;
    public float cameraHeight = 1.65f;
    public float lookSensitivity = 0.16f;

    private CharacterController characterController;
    private Transform visualRoot;
    private Transform leftLeg;
    private Transform rightLeg;
    private Transform leftArm;
    private Transform rightArm;
    private Transform swordPivot;
    private Transform cape;
    private Camera followCamera;
    private MobileVirtualJoystick joystick;

    private Vector3 horizontalVelocity;
    private float verticalVelocity;
    private float cameraYaw;
    private float cameraPitch = 10f;
    private float animationClock;
    private float attackTimer;
    private float cooldownTimer;
    private float comboWindow;
    private int comboStep;
    private bool attackHitApplied;
    private bool runHeld;
    private bool isRunning;

    public void Configure(
        Camera cameraToFollow,
        Transform visual,
        Transform leftLegPivot,
        Transform rightLegPivot,
        Transform leftArmPivot,
        Transform rightArmPivot,
        Transform weaponPivot,
        Transform capeTransform)
    {
        followCamera = cameraToFollow;
        visualRoot = visual;
        leftLeg = leftLegPivot;
        rightLeg = rightLegPivot;
        leftArm = leftArmPivot;
        rightArm = rightArmPivot;
        swordPivot = weaponPivot;
        cape = capeTransform;
    }

    public void BindJoystick(MobileVirtualJoystick source)
    {
        joystick = source;
    }

    private void Awake()
    {
        characterController = GetComponent<CharacterController>();
    }

    public void SetRunHeld(bool held)
    {
        runHeld = held;
    }

    public void Look(Vector2 dragDelta)
    {
        cameraYaw += dragDelta.x * lookSensitivity;
        cameraPitch = Mathf.Clamp(cameraPitch - dragDelta.y * lookSensitivity, -8f, 38f);
    }

    public void Attack()
    {
        if (cooldownTimer > 0f)
            return;

        comboStep = comboWindow <= 0f ? 0 : (comboStep + 1) % 3;
        comboWindow = 0.8f;
        cooldownTimer = attackCooldown;
        attackTimer = attackDuration;
        attackHitApplied = false;

        if (horizontalVelocity.sqrMagnitude < 0.04f)
            transform.rotation = Quaternion.Euler(0f, cameraYaw, 0f);
    }

    private void Update()
    {
        float dt = Time.deltaTime;
        cooldownTimer = Mathf.Max(0f, cooldownTimer - dt);
        comboWindow = Mathf.Max(0f, comboWindow - dt);
        if (attackTimer > 0f)
            AnimateAttack(dt);

        Vector2 input = joystick != null ? joystick.Value : Vector2.zero;
        Vector3 localDirection = new Vector3(input.x, 0f, input.y);
        Vector3 moveDirection = Quaternion.Euler(0f, cameraYaw, 0f) * localDirection;
        if (moveDirection.sqrMagnitude > 1f)
            moveDirection.Normalize();

        isRunning = runHeld && moveDirection.sqrMagnitude > 0.01f;
        float targetSpeed = isRunning ? runSpeed : walkSpeed;
        Vector3 targetVelocity = moveDirection * targetSpeed;
        horizontalVelocity = Vector3.MoveTowards(
            horizontalVelocity,
            targetVelocity,
            acceleration * dt
        );

        if (characterController.isGrounded)
            verticalVelocity = -0.5f;
        else
            verticalVelocity -= gravity * dt;

        Vector3 motion = horizontalVelocity + Vector3.up * verticalVelocity;
        characterController.Move(motion * dt);

        if (moveDirection.sqrMagnitude > 0.01f)
        {
            Quaternion facing = Quaternion.LookRotation(moveDirection, Vector3.up);
            transform.rotation = Quaternion.Slerp(transform.rotation, facing, turnSpeed * dt);
        }

        AnimateBody(dt, horizontalVelocity.magnitude > 0.15f);
    }

    private void LateUpdate()
    {
        if (followCamera == null)
            return;

        Quaternion rotation = Quaternion.Euler(cameraPitch, cameraYaw, 0f);
        Vector3 lookTarget = transform.position + Vector3.up * cameraHeight;
        followCamera.transform.position = lookTarget + rotation * new Vector3(0f, 0.35f, -cameraDistance);
        followCamera.transform.rotation = rotation;
    }

    private void AnimateAttack(float dt)
    {
        attackTimer = Mathf.Max(0f, attackTimer - dt);
        float progress = 1f - attackTimer / Mathf.Max(attackDuration, 0.01f);
        float swing = Mathf.Clamp01(progress / 0.72f);
        float comboOffset = comboStep * 9f;

        if (swordPivot != null)
            swordPivot.localRotation = Quaternion.Euler(0f, Mathf.Lerp(-65f + comboOffset, 72f + comboOffset, swing), 0f);
        if (rightArm != null)
            rightArm.localRotation = Quaternion.Euler(-44f + Mathf.Sin(swing * Mathf.PI) * 58f, 0f, -18f);

        if (!attackHitApplied && progress >= 0.28f)
        {
            attackHitApplied = true;
            ResolveSwordHit();
        }

        if (attackTimer <= 0f)
        {
            if (swordPivot != null)
                swordPivot.localRotation = Quaternion.Euler(0f, -18f, 0f);
            if (rightArm != null)
                rightArm.localRotation = Quaternion.Euler(-8f, 0f, -12f);
        }
    }

    private void ResolveSwordHit()
    {
        Vector3 hitCenter = transform.position + Vector3.up * 1.05f + transform.forward * 1.0f;
        Collider[] hits = Physics.OverlapSphere(hitCenter, attackReach, ~0, QueryTriggerInteraction.Ignore);
        float damage = swordDamage * (1f + comboStep * 0.16f);
        foreach (Collider hit in hits)
        {
            TrainingDummy target = hit.GetComponentInParent<TrainingDummy>();
            if (target != null)
            {
                target.TakeDamage(damage);
                SwordHit?.Invoke(damage);
            }
        }
    }

    private void AnimateBody(float dt, bool moving)
    {
        if (visualRoot == null)
            return;

        float speedRatio = Mathf.Clamp01(horizontalVelocity.magnitude / Mathf.Max(runSpeed, 0.01f));
        if (moving)
        {
            animationClock += dt * Mathf.Lerp(8.5f, 13.5f, speedRatio);
            float stride = Mathf.Sin(animationClock) * (isRunning ? 30f : 19f);
            if (leftLeg != null)
                leftLeg.localRotation = Quaternion.Euler(stride, 0f, 0f);
            if (rightLeg != null)
                rightLeg.localRotation = Quaternion.Euler(-stride, 0f, 0f);
            if (attackTimer <= 0f && leftArm != null)
                leftArm.localRotation = Quaternion.Euler(-stride * 0.55f, 0f, 8f);
            visualRoot.localPosition = Vector3.up * Mathf.Abs(Mathf.Sin(animationClock * 2f)) * (isRunning ? 0.075f : 0.035f);
        }
        else
        {
            animationClock = 0f;
            if (leftLeg != null)
                leftLeg.localRotation = Quaternion.Slerp(leftLeg.localRotation, Quaternion.identity, dt * 10f);
            if (rightLeg != null)
                rightLeg.localRotation = Quaternion.Slerp(rightLeg.localRotation, Quaternion.identity, dt * 10f);
            if (leftArm != null)
                leftArm.localRotation = Quaternion.Slerp(leftArm.localRotation, Quaternion.identity, dt * 7f);
            visualRoot.localPosition = Vector3.Lerp(visualRoot.localPosition, Vector3.zero, dt * 8f);
        }

        if (cape != null)
            cape.localRotation = Quaternion.Lerp(cape.localRotation, Quaternion.Euler(-6f - speedRatio * 12f, 0f, 0f), dt * 5f);
    }
}
