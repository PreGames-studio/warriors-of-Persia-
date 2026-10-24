using System;
using UnityEngine;
using WarriorsOfPersia.Gameplay;

namespace WarriorsOfPersia.Shop
{
    /// <summary>
    /// مدیریت موجودی طلای بازیکن (PlayerCurrency) با رویداد تغییر موجودی و همگام‌سازی خودکار با اقتصاد بازی.
    /// </summary>
    public class PlayerCurrency : MonoBehaviour
    {
        public static PlayerCurrency Instance { get; private set; }

        [Header("موجودی اولیه طلای بازیکن (مطابق تصویر مرجع ۱۲,۴۵۰ سکه)")]
        [SerializeField] private int currentGold = 12450;

        public event Action<int> OnGoldChanged;

        private WarriorsCompleteGame3D gameController;

        public int CurrentGold => currentGold;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(this);
                return;
            }
            Instance = this;

            gameController = FindObjectOfType<WarriorsCompleteGame3D>();
            if (gameController != null)
            {
                if (gameController.coins < currentGold)
                {
                    gameController.coins = currentGold;
                }
                else
                {
                    currentGold = gameController.coins;
                }
            }
        }

        public bool CanAfford(int price)
        {
            return price >= 0 && currentGold >= price;
        }

        public bool TrySpendGold(int amount)
        {
            if (amount < 0 || !CanAfford(amount))
            {
                return false;
            }

            currentGold -= amount;
            SyncWithMainGame();
            OnGoldChanged?.Invoke(currentGold);
            return true;
        }

        public void AddGold(int amount)
        {
            if (amount <= 0) return;
            currentGold += amount;
            SyncWithMainGame();
            OnGoldChanged?.Invoke(currentGold);
        }

        public string GetFormattedGold()
        {
            return currentGold.ToString("N0");
        }

        private void SyncWithMainGame()
        {
            if (gameController == null)
            {
                gameController = FindObjectOfType<WarriorsCompleteGame3D>();
            }
            if (gameController != null)
            {
                gameController.coins = currentGold;
                gameController.SaveGameProgress();
            }
            PlayerPrefs.SetInt("WarriorsOfPersia_Gold", currentGold);
            PlayerPrefs.Save();
        }
    }
}
