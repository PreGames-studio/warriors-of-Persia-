using UnityEngine;

namespace WarriorsOfPersia.Shop
{
    /// <summary>
    /// اتصال ساختمان مغازه آهنگری در نقشه روستا به پنجره فروشگاه آهنگری قرون‌وسطایی:
    /// با کلیک روی ساختمان مغازه آهنگری یا نزدیک شدن قهرمان و زدن کلید E، پنجره فروشگاه باز می‌شود.
    /// </summary>
    public class BlacksmithBuildingTrigger : MonoBehaviour
    {
        public float interactionRadius = 8.5f;

        private void OnMouseDown()
        {
            OpenBlacksmithWindow();
        }

        private void Update()
        {
            if (Input.GetKeyDown(KeyCode.E))
            {
                var hero = FindObjectOfType<WarriorsOfPersia.Units.HeroController3D>();
                if (hero != null && Vector3.Distance(hero.transform.position, transform.position) <= interactionRadius)
                {
                    OpenBlacksmithWindow();
                }
            }
        }

        public void OpenBlacksmithWindow()
        {
            if (BlacksmithShopManager.Instance == null)
            {
                GameObject shopGO = new GameObject("BlacksmithShopManager_System");
                shopGO.AddComponent<BlacksmithShopManager>();
            }
            BlacksmithShopManager.Instance.OpenShop();
        }
    }
}
