using System;
using UnityEngine;

namespace WarriorsOfPersia.Blacksmith
{
    /// <summary>Proximity-driven, animated and mobile-friendly entrance to the physical workshop.</summary>
    public sealed class BlacksmithDoor : MonoBehaviour
    {
        public float openAngle = 108f;
        public float rotationResponse = 4.6f;
        public bool IsOpen { get; private set; }
        public bool IsInside { get; private set; }
        public event Action PlayerEnteredInterior;
        public event Action<string> StatusChanged;

        private Quaternion closedRotation;
        private bool approaching;
        private bool configured;

        public void Configure()
        {
            if (configured) return;
            configured = true;
            closedRotation = transform.localRotation;
            CreateTrigger("Door approach trigger", new Vector3(1.4f, 1.65f, .75f), new Vector3(4.9f, 3.3f, 3.6f), false);
            CreateTrigger("Workshop interior trigger", new Vector3(1.4f, 1.55f, -2.15f), new Vector3(3.4f, 3.1f, 2.5f), true);
        }

        public void SetOpen(bool open)
        {
            IsOpen = open;
        }

        private void Start()
        {
            // A scene saved from the editor already contains its two trigger children.
            if (!configured)
            {
                configured = true;
                closedRotation = transform.localRotation;
            }
        }

        private void Update()
        {
            if (!configured) return;
            Quaternion target = closedRotation * Quaternion.Euler(0f, IsOpen ? openAngle : 0f, 0f);
            float response = 1f - Mathf.Exp(-rotationResponse * Time.deltaTime);
            transform.localRotation = Quaternion.Slerp(transform.localRotation, target, response);
        }

        private void CreateTrigger(string name, Vector3 localPosition, Vector3 size, bool interior)
        {
            GameObject trigger = new GameObject(name);
            // Volumes belong to the building, not the rotating hinge; otherwise they move with the door.
            Transform volumeParent = transform.parent;
            trigger.transform.SetParent(volumeParent, false);
            trigger.transform.localPosition = transform.localPosition + localPosition;
            BoxCollider collider = trigger.AddComponent<BoxCollider>();
            collider.isTrigger = true;
            collider.size = size;
            BlacksmithTriggerRelay relay = trigger.AddComponent<BlacksmithTriggerRelay>();
            relay.door = this;
            relay.interior = interior;
        }

        private static bool IsPlayer(Collider other)
        {
            return other.GetComponentInParent<SwordsmanController>() != null;
        }

        internal void Approach(Collider other, bool entered)
        {
            if (!IsPlayer(other)) return;
            approaching = entered;
            SetOpen(entered || IsInside);
            if (entered) StatusChanged?.Invoke("KAVEH'S FORGE  •  DOOR OPEN");
        }

        internal void Interior(Collider other, bool entered)
        {
            if (!IsPlayer(other)) return;
            IsInside = entered;
            SetOpen(entered || approaching);
            if (entered)
            {
                StatusChanged?.Invoke("KAVEH'S FORGE  •  WORKSHOP ENTERED");
                PlayerEnteredInterior?.Invoke();
            }
        }
    }

    /// <summary>Separates the approach and interior volumes while keeping the door itself independently editable.</summary>
    public sealed class BlacksmithTriggerRelay : MonoBehaviour
    {
        public BlacksmithDoor door;
        public bool interior;

        private void OnTriggerEnter(Collider other)
        {
            if (door == null) return;
            if (interior) door.Interior(other, true);
            else door.Approach(other, true);
        }

        private void OnTriggerExit(Collider other)
        {
            if (door == null) return;
            if (interior) door.Interior(other, false);
            else door.Approach(other, false);
        }
    }
}
