using System;
using UnityEngine;

namespace WarriorsOfPersia.Blacksmith
{
    /// <summary>Proximity-driven exterior door; the purchase UI replaces interior traversal.</summary>
    public sealed class BlacksmithDoor : MonoBehaviour
    {
        public float openAngle = 108f;
        public float rotationResponse = 4.6f;
        public bool IsOpen { get; private set; }
        public event Action<string> StatusChanged;

        private Quaternion closedRotation;
        private bool configured;

        public void Configure()
        {
            if (configured) return;
            configured = true;
            closedRotation = transform.localRotation;
            CreateTrigger("Door approach trigger", new Vector3(1.4f, 1.65f, .75f), new Vector3(4.9f, 3.3f, 3.6f), false);
        }

        public void SetOpen(bool open)
        {
            IsOpen = open;
        }

        private void Start()
        {
            // A scene saved from the editor already contains its approach trigger.
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
            SetOpen(entered);
            if (entered) StatusChanged?.Invoke("KAVEH'S FORGE  •  DOOR OPEN");
        }

    }

    /// <summary>Keeps the approach volume independent from the rotating exterior door.</summary>
    public sealed class BlacksmithTriggerRelay : MonoBehaviour
    {
        public BlacksmithDoor door;
        public bool interior;

        private void OnTriggerEnter(Collider other)
        {
            if (door == null) return;
            // Legacy serialized interior relays are intentionally inert.
            if (!interior) door.Approach(other, true);
        }

        private void OnTriggerExit(Collider other)
        {
            if (door == null) return;
            if (!interior) door.Approach(other, false);
        }
    }
}
