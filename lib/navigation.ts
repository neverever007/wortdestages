export function goBack(router: any, fallback: string = '/(tabs)/heute') {
  // In dieser App liegen viele Detailseiten versteckt innerhalb des Tab-Navigators.
  // router.back() springt dort auf Android häufig zum ersten Tab (Heute), obwohl
  // der Nutzer von Feed/Profil/Statistik kam. Deshalb verwenden Detailseiten
  // konsequent den mitgegebenen returnTo/fallback als Ziel.
  try {
    router.replace(fallback);
  } catch {
    try {
      router.push(fallback);
    } catch {
      // no-op
    }
  }
}
