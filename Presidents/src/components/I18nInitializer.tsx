"use client";

import { useEffect } from "react";
import { useApp } from "./AppProvider";
import { useTranslation } from "react-i18next";

export default function I18nInitializer() {
  const { prefs } = useApp();
  const { i18n } = useTranslation();

  useEffect(() => {
    if (i18n.language !== prefs.language) {
      i18n.changeLanguage(prefs.language);
    }
  }, [prefs.language, i18n]);

  return null;
}
