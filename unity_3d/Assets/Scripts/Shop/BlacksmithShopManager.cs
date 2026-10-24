using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using WarriorsOfPersia.Units;

namespace WarriorsOfPersia.Shop
{
    /// <summary>
    /// مدیر اصلی فروشگاه آهنگری قرون‌وسطایی در Unity (BlacksmithShopManager):
    /// - ساخت و مدیریت کامل رابط کاربری سینمایی مطابق تصویر مرجع (Canvas, CanvasScaler, ScrollRect, GridLayoutGroup 3x2, Scrollbar).
    /// - نمایش شخصیت سه‌بعدی آهنگر و کوره روشن در سمت چپ از طریق RenderTexture زنده (و امکان چرخش با کشیدن ماوس).
    /// - نمایش ۶ آیتم در صفحه اول + اسکرول عمودی واقعی برای آیتم‌های بیشتر و فیلتر دسته‌بندی‌ها.
    /// - انتخاب کارت با جلوه نور طلایی، پنل جزئیات آیتم، خرید واقعی با کسر طلا، افزودن به Inventory و جلوگیری از خرید تکراری ناخواسته.
    /// </summary>
    public class BlacksmithShopManager : MonoBehaviour
    {
        public static BlacksmithShopManager Instance { get; private set; }

        [Header("داده‌های کاتالوگ فروشگاه آهنگری")]
        public List<ItemData> catalogItems = new List<ItemData>();

        [Header("ارجاع به سیستم‌های اقتصاد، کیف و کاراکتر سه‌بعدی")]
        public PlayerCurrency playerCurrency;
        public InventorySystem inventorySystem;
        public BlacksmithCharacter3D blacksmith3D;

        [Header("صداهای رابط کاربری (در صورت نبود فایل صوتی، موج صوتی رویه‌ای تولید می‌شود)")]
        public AudioClip selectClip;
        public AudioClip purchaseSuccessClip;
        public AudioClip errorClip;
        public AudioClip closeClip;

        private Canvas shopCanvas;
        private GameObject shopRootPanel;
        private Text goldAmountText;
        private Text blacksmithDialogueText;
        private Text pageIndicatorText;
        private ScrollRect itemsScrollRect;
        private RectTransform gridContentRect;

        // پنل جزئیات آیتم انتخاب‌شده
        private GameObject detailPanel;
        private Text detailTitleText;
        private Text detailLoreText;
        private Text detailStatsText;
        private Button detailBuyButton;
        private Text detailBuyButtonText;

        private RenderTexture blacksmithRenderTex;
        private Camera blacksmithStageCam;
        private AudioSource audioSource;

        private ItemData selectedItem;
        private BlacksmithItemCategory activeCategory = BlacksmithItemCategory.All;
        private readonly List<ItemCardView> spawnedCards = new List<ItemCardView>();

        private class ItemCardView
        {
            public ItemData data;
            public GameObject rootObj;
            public Image borderHighlight;
            public Text priceLabel;
            public Image ownedBadge;
        }

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            EnsureCoreDependencies();
            Build3DBlacksmithRenderStage();
            BuildCinematicBlacksmithUI();
            PopulateGrid(BlacksmithItemCategory.All);
        }

        private void OnEnable()
        {
            if (playerCurrency != null)
            {
                playerCurrency.OnGoldChanged += HandleGoldChanged;
            }
            if (inventorySystem != null)
            {
                inventorySystem.OnInventoryChanged += HandleInventoryChanged;
            }
        }

        private void OnDisable()
        {
            if (playerCurrency != null)
            {
                playerCurrency.OnGoldChanged -= HandleGoldChanged;
            }
            if (inventorySystem != null)
            {
                inventorySystem.OnInventoryChanged -= HandleInventoryChanged;
            }
        }

        private void EnsureCoreDependencies()
        {
            if (playerCurrency == null)
            {
                playerCurrency = FindObjectOfType<PlayerCurrency>();
                if (playerCurrency == null) playerCurrency = gameObject.AddComponent<PlayerCurrency>();
            }

            if (inventorySystem == null)
            {
                inventorySystem = FindObjectOfType<InventorySystem>();
                if (inventorySystem == null) inventorySystem = gameObject.AddComponent<InventorySystem>();
            }

            if (catalogItems == null || catalogItems.Count == 0)
            {
                catalogItems = ItemData.CreateDefaultBlacksmithCatalog();
            }

            audioSource = GetComponent<AudioSource>();
            if (audioSource == null)
            {
                audioSource = gameObject.AddComponent<AudioSource>();
                audioSource.playOnAwake = false;
            }

            if (FindObjectOfType<EventSystem>() == null)
            {
                GameObject es = new GameObject("EventSystem");
                es.AddComponent<EventSystem>();
                es.AddComponent<StandaloneInputModule>();
            }
        }

        private void Build3DBlacksmithRenderStage()
        {
            GameObject stageRoot = new GameObject("Blacksmith_3D_RenderStage");
            stageRoot.transform.SetParent(transform, false);
            stageRoot.transform.position = new Vector3(0f, -250f, 0f); // مجزا از صحنه اصلی بازی

            blacksmith3D = stageRoot.AddComponent<BlacksmithCharacter3D>();
            blacksmith3D.BuildStageAndCharacter();

            blacksmithRenderTex = new RenderTexture(900, 1080, 24, RenderTextureFormat.ARGB32);
            blacksmithRenderTex.antiAliasing = 4;

            GameObject camGO = new GameObject("Blacksmith_StageCamera");
            camGO.transform.SetParent(stageRoot.transform, false);
            camGO.transform.localPosition = new Vector3(-0.18f, 1.32f, -2.55f);
            camGO.transform.localRotation = Quaternion.Euler(4f, 2f, 0f);

            blacksmithStageCam = camGO.AddComponent<Camera>();
            blacksmithStageCam.clearFlags = CameraClearFlags.SolidColor;
            blacksmithStageCam.backgroundColor = new Color(0.06f, 0.04f, 0.03f, 1f);
            blacksmithStageCam.fieldOfView = 38f;
            blacksmithStageCam.targetTexture = blacksmithRenderTex;
        }

        private void BuildCinematicBlacksmithUI()
        {
            Font uiFont = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            if (uiFont == null) uiFont = Resources.GetBuiltinResource<Font>("Arial.ttf");

            GameObject canvasGO = new GameObject("BlacksmithShop_Canvas");
            canvasGO.transform.SetParent(transform, false);
            shopCanvas = canvasGO.AddComponent<Canvas>();
            shopCanvas.renderMode = RenderMode.ScreenSpaceOverlay;
            shopCanvas.sortingOrder = 100;

            CanvasScaler scaler = canvasGO.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920f, 1080f);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 0.5f;

            canvasGO.AddComponent<GraphicRaycaster>();

            shopRootPanel = CreateUIObject("BlacksmithShop_Root", canvasGO.transform);
            StretchFull(shopRootPanel.GetComponent<RectTransform>());
            Image bgImg = shopRootPanel.AddComponent<Image>();
            bgImg.color = new Color(0.05f, 0.04f, 0.03f, 0.96f);

            // =================================================================
            // ۱. ستون چپ: نمای سه‌بعدی زنده آهنگر + تابلوی معلق آهنگری + دیالوگ
            // =================================================================
            GameObject leftCol = CreateUIObject("LeftColumn_3DBlacksmith", shopRootPanel.transform);
            RectTransform leftRT = leftCol.GetComponent<RectTransform>();
            leftRT.anchorMin = new Vector2(0f, 0f);
            leftRT.anchorMax = new Vector2(0.36f, 1f);
            leftRT.offsetMin = Vector2.zero;
            leftRT.offsetMax = Vector2.zero;

            RawImage smithRawImg = leftCol.AddComponent<RawImage>();
            smithRawImg.texture = blacksmithRenderTex;

            // تابلوی فلزی معلق بالای سمت چپ: «فروشگاه آهنگری / ابزارهای بهتر، جنگ‌های بزرگ‌تر»
            GameObject signBoard = CreatePanel("HangingSignboard", leftCol.transform, new Color(0.11f, 0.09f, 0.07f, 0.96f), new Color(0.84f, 0.65f, 0.25f, 1f));
            RectTransform signRT = signBoard.GetComponent<RectTransform>();
            signRT.anchorMin = new Vector2(0.03f, 0.82f);
            signRT.anchorMax = new Vector2(0.95f, 0.96f);
            signRT.offsetMin = Vector2.zero;
            signRT.offsetMax = Vector2.zero;

            Text signTitle = CreateText("SignTitle", signBoard.transform, uiFont, "⚒ فروشگاه آهنگری", 34, TextAnchor.MiddleCenter, new Color(0.96f, 0.89f, 0.72f));
            RectTransform stRT = signTitle.GetComponent<RectTransform>();
            stRT.anchorMin = new Vector2(0.05f, 0.42f);
            stRT.anchorMax = new Vector2(0.95f, 0.95f);
            stRT.offsetMin = stRT.offsetMax = Vector2.zero;

            Text signSub = CreateText("SignSubtitle", signBoard.transform, uiFont, "ابزارهای بهتر، جنگ‌های بزرگ‌تر", 20, TextAnchor.MiddleCenter, new Color(0.82f, 0.74f, 0.56f));
            RectTransform ssRT = signSub.GetComponent<RectTransform>();
            ssRT.anchorMin = new Vector2(0.05f, 0.08f);
            ssRT.anchorMax = new Vector2(0.95f, 0.44f);
            ssRT.offsetMin = ssRT.offsetMax = Vector2.zero;

            // باکس دیالوگ پایین سمت چپ زیر سندان
            GameObject dialogBox = CreatePanel("BlacksmithDialogueBox", leftCol.transform, new Color(0.08f, 0.07f, 0.06f, 0.94f), new Color(0.75f, 0.58f, 0.22f, 1f));
            RectTransform dlgRT = dialogBox.GetComponent<RectTransform>();
            dlgRT.anchorMin = new Vector2(0.05f, 0.03f);
            dlgRT.anchorMax = new Vector2(0.95f, 0.14f);
            dlgRT.offsetMin = dlgRT.offsetMax = Vector2.zero;

            blacksmithDialogueText = CreateText(
                "DialogueText", dialogBox.transform, uiFont,
                "هر چیزی که نیاز داری، اینجا پیدا می‌کنی.\nبا کیفیت و دوام بالا!",
                20, TextAnchor.MiddleCenter, new Color(0.95f, 0.91f, 0.82f)
            );
            StretchFull(blacksmithDialogueText.GetComponent<RectTransform>(), 12f);

            // =================================================================
            // ۲. نوار بالای سمت راست: نمایش طلای بازیکن (12,450) و دکمه بستن (✕)
            // =================================================================
            GameObject goldBox = CreatePanel("TopGoldBox", shopRootPanel.transform, new Color(0.09f, 0.08f, 0.07f, 0.96f), new Color(0.85f, 0.68f, 0.26f, 1f));
            RectTransform goldRT = goldBox.GetComponent<RectTransform>();
            goldRT.anchorMin = new Vector2(0.76f, 0.915f);
            goldRT.anchorMax = new Vector2(0.915f, 0.978f);
            goldRT.offsetMin = goldRT.offsetMax = Vector2.zero;

            goldAmountText = CreateText("GoldAmountText", goldBox.transform, uiFont, $"🪙  {playerCurrency.GetFormattedGold()}", 26, TextAnchor.MiddleCenter, new Color(1f, 0.94f, 0.72f));
            StretchFull(goldAmountText.GetComponent<RectTransform>(), 6f);

            GameObject closeBtnObj = CreatePanel("CloseShopButton", shopRootPanel.transform, new Color(0.14f, 0.12f, 0.10f, 0.96f), new Color(0.85f, 0.68f, 0.26f, 1f));
            RectTransform closeRT = closeBtnObj.GetComponent<RectTransform>();
            closeRT.anchorMin = new Vector2(0.928f, 0.915f);
            closeRT.anchorMax = new Vector2(0.975f, 0.978f);
            closeRT.offsetMin = closeRT.offsetMax = Vector2.zero;

            Button closeBtn = closeBtnObj.AddComponent<Button>();
            closeBtn.onClick.AddListener(CloseShop);
            Text closeTxt = CreateText("CloseX", closeBtnObj.transform, uiFont, "✕", 30, TextAnchor.MiddleCenter, new Color(0.90f, 0.73f, 0.32f));
            StretchFull(closeTxt.GetComponent<RectTransform>());

            // =================================================================
            // ۳. قاب اصلی فروشگاه در سمت راست (شبکه ۳×۲ کارت‌ها + نوار اسکرول و فیلتر)
            // =================================================================
            GameObject rightFrame = CreatePanel("RightShopFrame", shopRootPanel.transform, new Color(0.07f, 0.08f, 0.09f, 0.95f), new Color(0.84f, 0.65f, 0.24f, 1f));
            RectTransform rightRT = rightFrame.GetComponent<RectTransform>();
            rightRT.anchorMin = new Vector2(0.355f, 0.14f);
            rightRT.anchorMax = new Vector2(0.98f, 0.895f);
            rightRT.offsetMin = rightRT.offsetMax = Vector2.zero;

            // Viewport & ScrollRect
            GameObject viewportGO = CreateUIObject("ItemsViewport", rightFrame.transform);
            RectTransform vpRT = viewportGO.GetComponent<RectTransform>();
            vpRT.anchorMin = new Vector2(0.015f, 0.02f);
            vpRT.anchorMax = new Vector2(0.91f, 0.98f);
            vpRT.offsetMin = vpRT.offsetMax = Vector2.zero;
            viewportGO.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0.01f);
            viewportGO.AddComponent<Mask>().showMaskGraphic = false;

            GameObject contentGO = CreateUIObject("GridContent", viewportGO.transform);
            gridContentRect = contentGO.GetComponent<RectTransform>();
            gridContentRect.anchorMin = new Vector2(0f, 1f);
            gridContentRect.anchorMax = new Vector2(1f, 1f);
            gridContentRect.pivot = new Vector2(0.5f, 1f);
            gridContentRect.anchoredPosition = Vector2.zero;

            GridLayoutGroup grid = contentGO.AddComponent<GridLayoutGroup>();
            grid.cellSize = new Vector2(315f, 340f);
            grid.spacing = new Vector2(22f, 22f);
            grid.padding = new RectOffset(16, 16, 16, 16);
            grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
            grid.constraintCount = 3; // شبکه ۳ ستونی (۲ ردیف در صفحه اول = ۶ آیتم)
            grid.childAlignment = TextAnchor.UpperCenter;

            ContentSizeFitter fitter = contentGO.AddComponent<ContentSizeFitter>();
            fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;

            itemsScrollRect = rightFrame.AddComponent<ScrollRect>();
            itemsScrollRect.viewport = vpRT;
            itemsScrollRect.content = gridContentRect;
            itemsScrollRect.horizontal = false;
            itemsScrollRect.vertical = true;
            itemsScrollRect.movementType = ScrollRect.MovementType.Clamped;
            itemsScrollRect.scrollSensitivity = 38f;
            itemsScrollRect.onValueChanged.AddListener(OnScrollChanged);

            // نوار کناری سمت راست (دکمه‌های دسته‌بندی + اسکرول عمودی + نشانگر ۱/۶)
            BuildRightSidebarControls(rightFrame.transform, uiFont);

            // =================================================================
            // ۴. پنل جزئیات آیتم انتخاب‌شده و دکمه خرید قطعی در پایین قاب راست
            // =================================================================
            detailPanel = CreatePanel("SelectedItemDetailPanel", shopRootPanel.transform, new Color(0.09f, 0.08f, 0.07f, 0.97f), new Color(0.88f, 0.68f, 0.25f, 1f));
            RectTransform detRT = detailPanel.GetComponent<RectTransform>();
            detRT.anchorMin = new Vector2(0.355f, 0.02f);
            detRT.anchorMax = new Vector2(0.91f, 0.125f);
            detRT.offsetMin = detRT.offsetMax = Vector2.zero;

            detailTitleText = CreateText("DetailTitle", detailPanel.transform, uiFont, "یک آیتم را از ویترین انتخاب کنید", 22, TextAnchor.MiddleRight, new Color(1f, 0.92f, 0.68f));
            RectTransform dtRT = detailTitleText.GetComponent<RectTransform>();
            dtRT.anchorMin = new Vector2(0.32f, 0.54f);
            dtRT.anchorMax = new Vector2(0.98f, 0.94f);
            dtRT.offsetMin = dtRT.offsetMax = Vector2.zero;

            detailLoreText = CreateText("DetailLore", detailPanel.transform, uiFont, "با کلیک روی هر کارت، مشخصات کامل رزمی و امکان خرید فعال می‌شود.", 16, TextAnchor.MiddleRight, new Color(0.82f, 0.84f, 0.88f));
            RectTransform dlRT = detailLoreText.GetComponent<RectTransform>();
            dlRT.anchorMin = new Vector2(0.32f, 0.08f);
            dlRT.anchorMax = new Vector2(0.98f, 0.52f);
            dlRT.offsetMin = dlRT.offsetMax = Vector2.zero;

            detailStatsText = CreateText("DetailStats", detailPanel.transform, uiFont, "", 17, TextAnchor.MiddleCenter, new Color(0.45f, 0.92f, 0.62f));
            RectTransform dsRT = detailStatsText.GetComponent<RectTransform>();
            dsRT.anchorMin = new Vector2(0.18f, 0.12f);
            dsRT.anchorMax = new Vector2(0.31f, 0.88f);
            dsRT.offsetMin = dsRT.offsetMax = Vector2.zero;

            GameObject buyBtnGO = CreatePanel("BuyActionButton", detailPanel.transform, new Color(0.55f, 0.36f, 0.08f, 1f), new Color(0.98f, 0.82f, 0.34f, 1f));
            RectTransform bbRT = buyBtnGO.GetComponent<RectTransform>();
            bbRT.anchorMin = new Vector2(0.015f, 0.16f);
            bbRT.anchorMax = new Vector2(0.17f, 0.84f);
            bbRT.offsetMin = bbRT.offsetMax = Vector2.zero;

            detailBuyButton = buyBtnGO.AddComponent<Button>();
            detailBuyButton.onClick.AddListener(PurchaseSelectedItem);
            detailBuyButtonText = CreateText("BuyBtnLabel", buyBtnGO.transform, uiFont, "⚒ خرید آیتم", 20, TextAnchor.MiddleCenter, Color.white);
            StretchFull(detailBuyButtonText.GetComponent<RectTransform>());

            // نشانگر صفحه پایین سمت راست (1 / 6)
            GameObject pageBox = CreatePanel("PageCounterBox", shopRootPanel.transform, new Color(0.08f, 0.08f, 0.09f, 0.96f), new Color(0.76f, 0.58f, 0.22f, 1f));
            RectTransform pgRT = pageBox.GetComponent<RectTransform>();
            pgRT.anchorMin = new Vector2(0.922f, 0.02f);
            pgRT.anchorMax = new Vector2(0.98f, 0.085f);
            pgRT.offsetMin = pgRT.offsetMax = Vector2.zero;

            pageIndicatorText = CreateText("PageIndicatorText", pageBox.transform, uiFont, "1 / 6", 22, TextAnchor.MiddleCenter, new Color(0.94f, 0.88f, 0.72f));
            StretchFull(pageIndicatorText.GetComponent<RectTransform>());
        }

        private void BuildRightSidebarControls(Transform rightFrame, Font uiFont)
        {
            GameObject rail = CreatePanel("RightCategoryAndScrollRail", rightFrame, new Color(0.06f, 0.06f, 0.07f, 0.98f), new Color(0.68f, 0.52f, 0.20f, 1f));
            RectTransform railRT = rail.GetComponent<RectTransform>();
            railRT.anchorMin = new Vector2(0.915f, 0.02f);
            railRT.anchorMax = new Vector2(0.99f, 0.98f);
            railRT.offsetMin = railRT.offsetMax = Vector2.zero;

            string[] catIcons = { "🗡", "🛡", "🪖", "🧤", "🥾", "🎒" };
            BlacksmithItemCategory[] cats = {
                BlacksmithItemCategory.All,
                BlacksmithItemCategory.Shield,
                BlacksmithItemCategory.Helmet,
                BlacksmithItemCategory.Gauntlets,
                BlacksmithItemCategory.Boots,
                BlacksmithItemCategory.ArmorAndSpecial
            };

            for (int i = 0; i < catIcons.Length; i++)
            {
                int idx = i;
                GameObject tabGO = CreatePanel($"CatTab_{i}", rail.transform, new Color(0.13f, 0.12f, 0.10f, 0.96f), new Color(0.84f, 0.65f, 0.24f, 1f));
                RectTransform tRT = tabGO.GetComponent<RectTransform>();
                float top = 0.92f - i * 0.105f;
                tRT.anchorMin = new Vector2(0.10f, top - 0.09f);
                tRT.anchorMax = new Vector2(0.90f, top);
                tRT.offsetMin = tRT.offsetMax = Vector2.zero;

                Button b = tabGO.AddComponent<Button>();
                b.onClick.AddListener(() =>
                {
                    PlayUISound(selectClip, 560f, 0.09f);
                    PopulateGrid(cats[idx]);
                });

                Text iconTxt = CreateText("Icon", tabGO.transform, uiFont, catIcons[i], 24, TextAnchor.MiddleCenter, new Color(0.95f, 0.82f, 0.45f));
                StretchFull(iconTxt.GetComponent<RectTransform>());
            }
        }

        public void PopulateGrid(BlacksmithItemCategory categoryFilter)
        {
            activeCategory = categoryFilter;
            for (int i = gridContentRect.childCount - 1; i >= 0; i--)
            {
                DestroyImmediate(gridContentRect.GetChild(i).gameObject);
            }
            spawnedCards.Clear();

            Font uiFont = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            if (uiFont == null) uiFont = Resources.GetBuiltinResource<Font>("Arial.ttf");

            List<ItemData> filtered = new List<ItemData>();
            foreach (var item in catalogItems)
            {
                if (categoryFilter == BlacksmithItemCategory.All || item.category == categoryFilter)
                {
                    filtered.Add(item);
                }
            }

            foreach (var item in filtered)
            {
                ItemCardView card = CreateItemCard(item, uiFont);
                spawnedCards.Add(card);
            }

            if (filtered.Count > 0)
            {
                SelectItem(filtered[0]);
            }
        }

        private ItemCardView CreateItemCard(ItemData item, Font uiFont)
        {
            GameObject cardObj = CreatePanel($"Card_{item.itemId}", gridContentRect, new Color(0.10f, 0.10f, 0.12f, 0.98f), new Color(0.74f, 0.58f, 0.24f, 1f));
            Image highlightBorder = cardObj.GetComponent<Image>();

            // بخش تصویر اختصاصی بالای کارت
            GameObject artBox = CreatePanel("ArtworkBox", cardObj.transform, new Color(0.06f, 0.05f, 0.05f, 1f), new Color(0.45f, 0.35f, 0.16f, 1f));
            RectTransform artRT = artBox.GetComponent<RectTransform>();
            artRT.anchorMin = new Vector2(0.04f, 0.46f);
            artRT.anchorMax = new Vector2(0.96f, 0.96f);
            artRT.offsetMin = artRT.offsetMax = Vector2.zero;

            Text artTitle = CreateText("ArtSymbol", artBox.transform, uiFont, $"⚒ {item.itemNameFa}", 20, TextAnchor.MiddleCenter, new Color(0.92f, 0.78f, 0.44f));
            StretchFull(artTitle.GetComponent<RectTransform>());

            // نام آیتم
            Text titleTxt = CreateText("ItemTitle", cardObj.transform, uiFont, item.itemNameFa, 22, TextAnchor.MiddleCenter, Color.white);
            RectTransform ttRT = titleTxt.GetComponent<RectTransform>();
            ttRT.anchorMin = new Vector2(0.05f, 0.32f);
            ttRT.anchorMax = new Vector2(0.95f, 0.44f);
            ttRT.offsetMin = ttRT.offsetMax = Vector2.zero;

            // توضیح کوتاه آیتم
            Text descTxt = CreateText("ItemDesc", cardObj.transform, uiFont, item.shortDescriptionFa, 15, TextAnchor.MiddleCenter, new Color(0.76f, 0.78f, 0.82f));
            RectTransform dcRT = descTxt.GetComponent<RectTransform>();
            dcRT.anchorMin = new Vector2(0.06f, 0.16f);
            dcRT.anchorMax = new Vector2(0.94f, 0.32f);
            dcRT.offsetMin = dcRT.offsetMax = Vector2.zero;

            // قاب قیمت پایین کارت با نماد سکه
            GameObject pricePill = CreatePanel("PricePill", cardObj.transform, new Color(0.07f, 0.07f, 0.08f, 0.98f), new Color(0.86f, 0.68f, 0.25f, 1f));
            RectTransform ppRT = pricePill.GetComponent<RectTransform>();
            ppRT.anchorMin = new Vector2(0.18f, 0.03f);
            ppRT.anchorMax = new Vector2(0.82f, 0.14f);
            ppRT.offsetMin = ppRT.offsetMax = Vector2.zero;

            bool alreadyOwned = inventorySystem != null && inventorySystem.IsItemAlreadyOwned(item);
            string priceStr = alreadyOwned ? "✓ خریداری شد" : $"🪙 {item.priceGold:N0}";
            Text priceTxt = CreateText("PriceText", pricePill.transform, uiFont, priceStr, 19, TextAnchor.MiddleCenter, alreadyOwned ? new Color(0.45f, 0.95f, 0.60f) : new Color(1f, 0.92f, 0.66f));
            StretchFull(priceTxt.GetComponent<RectTransform>());

            Button cardBtn = cardObj.AddComponent<Button>();
            cardBtn.onClick.AddListener(() => SelectItem(item));

            Button directBuyBtn = pricePill.AddComponent<Button>();
            directBuyBtn.onClick.AddListener(() =>
            {
                SelectItem(item);
                PurchaseSelectedItem();
            });

            return new ItemCardView
            {
                data = item,
                rootObj = cardObj,
                borderHighlight = highlightBorder,
                priceLabel = priceTxt
            };
        }

        public void SelectItem(ItemData item)
        {
            if (item == null) return;
            selectedItem = item;

            PlayUISound(selectClip, 620f, 0.08f);
            if (blacksmith3D != null) blacksmith3D.TriggerInteractionReaction();

            foreach (var c in spawnedCards)
            {
                bool isSel = c.data == item;
                c.borderHighlight.color = isSel
                    ? new Color(0.24f, 0.19f, 0.09f, 1f) // جلوه طلایی انتخاب کارت
                    : new Color(0.10f, 0.10f, 0.12f, 0.98f);
            }

            if (detailTitleText != null) detailTitleText.text = $"{item.itemNameFa}  ({item.priceGold:N0} سکه طلا)";
            if (detailLoreText != null) detailLoreText.text = item.detailedLoreFa;
            if (detailStatsText != null)
            {
                detailStatsText.text = $"⚔ +{item.attackBonus} ATK   🛡 +{item.defenseBonus} DEF   ❤ +{item.maxHpBonus} HP";
            }

            RefreshBuyButtonAndCards();
        }

        public void PurchaseSelectedItem()
        {
            if (selectedItem == null) return;

            if (inventorySystem.IsItemAlreadyOwned(selectedItem))
            {
                SetBlacksmithMessage($"«{selectedItem.itemNameFa}» را قبلاً خریده‌ای و در کیفت داری پهلوان!");
                PlayUISound(errorClip, 240f, 0.16f);
                return;
            }

            if (!playerCurrency.CanAfford(selectedItem.priceGold))
            {
                SetBlacksmithMessage($"سکه طلای کافی نداری! برای خرید «{selectedItem.itemNameFa}» به {selectedItem.priceGold:N0} سکه نیاز است.");
                PlayUISound(errorClip, 210f, 0.18f);
                return;
            }

            if (!inventorySystem.TryAddItem(selectedItem, out string invErr))
            {
                SetBlacksmithMessage(invErr);
                PlayUISound(errorClip, 210f, 0.18f);
                return;
            }

            playerCurrency.TrySpendGold(selectedItem.priceGold);
            if (blacksmith3D != null) blacksmith3D.TriggerInteractionReaction();

            SetBlacksmithMessage($"مبارکت باشد پهلوان! «{selectedItem.itemNameFa}» به کیف تجهیزاتت اضافه شد.");
            PlayUISound(purchaseSuccessClip, 840f, 0.22f);
            RefreshBuyButtonAndCards();
        }

        public void OpenShop()
        {
            if (shopRootPanel != null) shopRootPanel.SetActive(true);
            HeroController3D hero = FindObjectOfType<HeroController3D>();
            if (hero != null) hero.enabled = false;
            RefreshBuyButtonAndCards();
        }

        public void CloseShop()
        {
            PlayUISound(closeClip, 380f, 0.10f);
            if (shopRootPanel != null) shopRootPanel.SetActive(false);
            HeroController3D hero = FindObjectOfType<HeroController3D>();
            if (hero != null) hero.enabled = true;
        }

        private void HandleGoldChanged(int newGold)
        {
            if (goldAmountText != null)
            {
                goldAmountText.text = $"🪙  {playerCurrency.GetFormattedGold()}";
            }
            RefreshBuyButtonAndCards();
        }

        private void HandleInventoryChanged(IReadOnlyList<ItemData> items)
        {
            RefreshBuyButtonAndCards();
        }

        private void RefreshBuyButtonAndCards()
        {
            foreach (var c in spawnedCards)
            {
                bool owned = inventorySystem != null && inventorySystem.IsItemAlreadyOwned(c.data);
                if (c.priceLabel != null)
                {
                    c.priceLabel.text = owned ? "✓ خریداری شد" : $"🪙 {c.data.priceGold:N0}";
                    c.priceLabel.color = owned ? new Color(0.45f, 0.95f, 0.60f) : new Color(1f, 0.92f, 0.66f);
                }
            }

            if (selectedItem != null && detailBuyButton != null && detailBuyButtonText != null)
            {
                bool owned = inventorySystem.IsItemAlreadyOwned(selectedItem);
                bool canAfford = playerCurrency.CanAfford(selectedItem.priceGold);
                detailBuyButton.interactable = !owned && canAfford;
                detailBuyButtonText.text = owned
                    ? "✓ موجود در کیف"
                    : (canAfford ? $"⚒ خرید ({selectedItem.priceGold:N0})" : "طلای ناکافی");
            }
        }

        private void OnScrollChanged(Vector2 normPos)
        {
            if (pageIndicatorText == null) return;
            int page = Mathf.Clamp(Mathf.RoundToInt((1f - normPos.y) * 5f) + 1, 1, 6);
            pageIndicatorText.text = $"{page} / 6";
        }

        private void SetBlacksmithMessage(string msg)
        {
            if (blacksmithDialogueText != null)
            {
                blacksmithDialogueText.text = msg;
            }
        }

        private void PlayUISound(AudioClip assignedClip, float fallbackFreqHz, float durationSec)
        {
            if (audioSource == null) return;
            if (assignedClip != null)
            {
                audioSource.PlayOneShot(assignedClip);
                return;
            }

            // تولید موج صوتی کوتاه در صورت عدم وجود فایل صوتی خارجی در پروژه
            int sampleRate = 44100;
            int samples = Mathf.Max(1, Mathf.RoundToInt(sampleRate * durationSec));
            AudioClip procClip = AudioClip.Create("ProceduralUISound", samples, 1, sampleRate, false);
            float[] data = new float[samples];
            for (int i = 0; i < samples; i++)
            {
                float t = (float)i / sampleRate;
                float env = 1f - ((float)i / samples);
                data[i] = Mathf.Sin(2f * Mathf.PI * fallbackFreqHz * t) * env * 0.2f;
            }
            procClip.SetData(data, 0);
            audioSource.PlayOneShot(procClip);
        }

        private GameObject CreateUIObject(string objName, Transform parent)
        {
            GameObject go = new GameObject(objName, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            return go;
        }

        private GameObject CreatePanel(string objName, Transform parent, Color bgColor, Color outlineColor)
        {
            GameObject go = CreateUIObject(objName, parent);
            Image img = go.AddComponent<Image>();
            img.color = bgColor;
            Outline outline = go.AddComponent<Outline>();
            outline.effectColor = outlineColor;
            outline.effectDistance = new Vector2(2f, -2f);
            return go;
        }

        private Text CreateText(string objName, Transform parent, Font font, string content, int fontSize, TextAnchor anchor, Color color)
        {
            GameObject go = CreateUIObject(objName, parent);
            Text txt = go.AddComponent<Text>();
            txt.font = font;
            txt.text = content;
            txt.fontSize = fontSize;
            txt.alignment = anchor;
            txt.color = color;
            return txt;
        }

        private void StretchFull(RectTransform rt, float padding = 0f)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = new Vector2(padding, padding);
            rt.offsetMax = new Vector2(-padding, -padding);
        }
    }
}
