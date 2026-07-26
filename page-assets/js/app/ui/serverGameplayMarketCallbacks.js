import { formatMarketPrice } from "./marketPanel.js";

export function createServerMarketCatalogCallbacks({
  activeTab,
  feedback,
  submitMarketAction,
  windowRef
}) {
  const submit = async (action, preview, success, tone = "success") => {
    if (typeof windowRef?.confirm === "function" && windowRef.confirm(preview) === false) return null;
    feedback("info", "Kontakt potvrzuje obchod...");
    const response = await submitMarketAction(action);
    feedback(
      response?.accepted ? tone : "warning",
      response?.accepted ? success : response?.errors?.[0]?.message || "Obchod neprošel."
    );
    return response;
  };
  return {
    getTradeState: (item, quantity) => ({
      buyDisabled: item?.canBuy !== true,
      sellDisabled: activeTab === "black-market" || item?.canSell !== true || Number(item?.amount || 0) < quantity,
      buyTitle: item?.canBuy === true ? "Koupit z trhu." : "Tenhle obchod teď nejde uzavřít.",
      sellTitle: item?.canSell === true ? "Prodat do trhu." : "Nemáš dost zboží na prodej.",
      totalLabel: activeTab === "black-market" && Number(item?.heatRisk || 0) > 0
        ? `Celkem ${formatMarketPrice(quantity * Number(item?.buyPrice || 0))} · Heat +${Number(item.heatRisk)}`
        : `Celkem ${formatMarketPrice(quantity * Number(item?.buyPrice || 0))} · prodej ${formatMarketPrice(quantity * Number(item?.sellPrice || 0))}`
    }),
    onBuyItem: (item, quantity) => submit({
      action: "buy",
      resourceId: item?.resourceId,
      amount: quantity,
      marketType: activeTab === "black-market" ? "black" : "normal",
      paymentType: item?.paymentType === "cleanCash"
        ? "cleanCash"
        : activeTab === "black-market" ? "dirtyCash" : "cleanCash"
    }, `Potvrdit nákup ${quantity}x ${item?.name} za ${formatMarketPrice(quantity * Number(item?.buyPrice || 0))}?`,
    `${activeTab === "black-market" ? "Kontakt předal" : "Trh vydal"} ${quantity}x ${item?.name}.`,
    activeTab === "black-market" ? "danger" : "success"),
    onSellItem: (item, quantity) => submit({
      action: "sell",
      resourceId: item?.resourceId,
      amount: quantity
    }, `Potvrdit prodej ${quantity}x ${item?.name} za ${formatMarketPrice(quantity * Number(item?.sellPrice || 0))}?`,
    `Trh převzal ${quantity}x ${item?.name}.`)
  };
}
