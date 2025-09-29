import { useState, useEffect, useCallback } from 'react';
import { LanguageCode } from '../types';

type TranslationModule = { default: { [key: string]: string } };

// Statically analyzable dynamic imports to ensure bundler compatibility
function getTranslationModule(lang: LanguageCode): Promise<TranslationModule> {
    switch (lang) {
        case 'en': return import('../locales/en');
        case 'tr': return import('../locales/tr');
        case 'es': return import('../locales/es');
        case 'de': return import('../locales/de');
        case 'fr': return import('../locales/fr');
        case 'zh': return import('../locales/zh');
        case 'hi': return import('../locales/hi');
        case 'ar': return import('../locales/ar');
        case 'bn': return import('../locales/bn');
        case 'ru': return import('../locales/ru');
        case 'pt': return import('../locales/pt');
        case 'ur': return import('../locales/ur');
        case 'id': return import('../locales/id');
        case 'ja': return import('../locales/ja');
        case 'pcm': return import('../locales/pcm');
        case 'mr': return import('../locales/mr');
        case 'te': return import('../locales/te');
        case 'ta': return import('../locales/ta');
        case 'yue': return import('../locales/yue');
        case 'vi': return import('../locales/vi');
        default: return import('../locales/en');
    }
}

const DEFAULT_LANGUAGE: LanguageCode = 'en';

// Cache to store loaded language modules
const translationsCache = new Map<LanguageCode, { [key: string]: string }>();

// Helper to load and cache a language module
async function loadLanguage(lang: LanguageCode): Promise<{ [key: string]: string } | null> {
    if (translationsCache.has(lang)) {
        return translationsCache.get(lang)!;
    }

    try {
        const module = await getTranslationModule(lang);
        translationsCache.set(lang, module.default);
        return module.default;
    } catch (error) {
        console.error(`Could not load translations for ${lang}`, error);
        return null;
    }
}

export const useTranslation = (language: LanguageCode) => {
    const [translations, setTranslations] = useState<{ [key: string]: string } | null>(null);

    useEffect(() => {
        const load = async () => {
            // Ensure default language is always loaded and cached first
            await loadLanguage(DEFAULT_LANGUAGE);
            // Load the currently selected language
            const currentTranslations = await loadLanguage(language);
            // Set the state. If the selected language fails to load, fallback to default.
            setTranslations(currentTranslations ?? translationsCache.get(DEFAULT_LANGUAGE) ?? null);
        };
        load();
    }, [language]);

    const t = useCallback((key: string, params?: { [key: string]: string | number }): string => {
        const defaultTranslations = translationsCache.get(DEFAULT_LANGUAGE);
        
        // Try to get translation from the current language, fallback to default, then to the key itself
        let text = translations?.[key] ?? defaultTranslations?.[key];

        if (text === undefined) {
            console.warn(`Translation not found for key: ${key}`);
            return key;
        }

        if (params) {
            Object.keys(params).forEach(paramKey => {
                text = text!.replace(new RegExp(`{${paramKey}}`, 'g'), String(params[paramKey]));
            });
        }
        return text!;
    }, [translations]);

    return { t };
};
