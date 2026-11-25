import { generatedShop } from './generatedShopEnv';

export const deploymentDefaults = {
  shopName: generatedShop.shopName,
  shopNameWasSet: generatedShop.shopNameWasSet,
  shopId: generatedShop.shopId,
  shopShortName: generatedShop.shopShortName,
  tagline: generatedShop.tagline,
  accentColor: generatedShop.accentColor,
  locationLabel: generatedShop.locationLabel,
  appTitle: generatedShop.appTitle,
  logoUrl: generatedShop.logoUrl,
  fallbackShopId: generatedShop.fallbackShopId,
  fallbackShortName: generatedShop.fallbackShortName,
  littleRockPageTitle: generatedShop.littleRockPageTitle,
};

export const firebaseConfig = generatedShop.firebaseConfig;
export const firebaseConfigError = generatedShop.firebaseConfigError;

/** Browser tab title. Little Rock keeps "Short name buying desk". */
export function pageTitle(settings) {
  if (deploymentDefaults.appTitle) return deploymentDefaults.appTitle;
  const shortName = (settings && settings.shopShortName) || 'GameDay';
  return `${shortName} buying desk`;
}
