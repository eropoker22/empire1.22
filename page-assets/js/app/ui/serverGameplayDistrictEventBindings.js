export function bindServerGameplayDistrictEvents({
  closeElements,
  documentRef,
  elements,
  handlers
}) {
  elements.popupCard.addEventListener("pointerdown", handlers.stopContentEvent);
  elements.popupCard.addEventListener("pointerup", handlers.stopContentEvent);
  elements.popupCard.addEventListener("click", handlers.stopContentEvent);
  elements.popupBuildingsList?.addEventListener?.("click", handlers.onBuildingClick);
  elements.popupToggle?.addEventListener?.("click", handlers.onOverviewToggle);
  elements.popupAtmosphereHero?.addEventListener?.("click", handlers.onAtmosphereOpen);
  elements.popupAtmosphereHero?.addEventListener?.("keydown", handlers.onAtmosphereOpen);
  elements.popupAtmosphereWindow?.addEventListener?.("click", handlers.stopContentEvent);
  elements.popupAtmosphereWindowClose?.addEventListener?.("click", handlers.onAtmosphereClose);
  for (const element of closeElements) {
    element.addEventListener("pointerdown", handlers.onClosePointer);
    element.addEventListener("pointerup", handlers.onClosePointer);
    element.addEventListener("click", handlers.onCloseClick);
  }
  documentRef?.addEventListener?.("keydown", handlers.onKeydown);

  return () => {
    elements.popupCard?.removeEventListener?.("pointerdown", handlers.stopContentEvent);
    elements.popupCard?.removeEventListener?.("pointerup", handlers.stopContentEvent);
    elements.popupCard?.removeEventListener?.("click", handlers.stopContentEvent);
    elements.popupBuildingsList?.removeEventListener?.("click", handlers.onBuildingClick);
    elements.popupToggle?.removeEventListener?.("click", handlers.onOverviewToggle);
    elements.popupAtmosphereHero?.removeEventListener?.("click", handlers.onAtmosphereOpen);
    elements.popupAtmosphereHero?.removeEventListener?.("keydown", handlers.onAtmosphereOpen);
    elements.popupAtmosphereWindow?.removeEventListener?.("click", handlers.stopContentEvent);
    elements.popupAtmosphereWindowClose?.removeEventListener?.("click", handlers.onAtmosphereClose);
    for (const element of closeElements) {
      element.removeEventListener("pointerdown", handlers.onClosePointer);
      element.removeEventListener("pointerup", handlers.onClosePointer);
      element.removeEventListener("click", handlers.onCloseClick);
    }
    documentRef?.removeEventListener?.("keydown", handlers.onKeydown);
  };
}
