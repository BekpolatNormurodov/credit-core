import React, { createContext, useContext, useState } from 'react';

export type Lang = 'uz' | 'ru';

const dict: Record<string, { uz: string; ru: string }> = {
  'nav.applications': { uz: 'Arizalar', ru: 'Заявки' },
  'nav.new': { uz: 'Yangi ariza', ru: 'Новая заявка' },
  'nav.calculator': { uz: 'Kalkulyator', ru: 'Калькулятор' },
  'nav.chats': { uz: 'Chatlar', ru: 'Чаты' },
  'nav.monitoring': { uz: 'Monitoring', ru: 'Мониторинг' },
  'nav.notifications': { uz: 'Bildirishnomalar', ru: 'Уведомления' },
  'nav.branches': { uz: 'Filiallar', ru: 'Филиалы' },
  'nav.users': { uz: 'Foydalanuvchilar', ru: 'Пользователи' },
  'nav.settings': { uz: 'Sozlamalar', ru: 'Настройки' },
  'common.logout': { uz: 'Chiqish', ru: 'Выход' },
  'common.save': { uz: 'Saqlash', ru: 'Сохранить' },
  'common.search': { uz: 'Qidirish…', ru: 'Поиск…' },
  'common.add': { uz: 'Qo‘shish', ru: 'Добавить' },
  'login.title': { uz: 'Kirish', ru: 'Вход' },
  'login.login': { uz: 'Login', ru: 'Логин' },
  'login.password': { uz: 'Parol', ru: 'Пароль' },
};

const I18nCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string }>({
  lang: 'uz', setLang: () => {}, t: (k) => k,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem('cc_lang') as Lang) || 'uz');
  const setLang = (l: Lang) => { localStorage.setItem('cc_lang', l); setLangState(l); };
  const t = (k: string) => dict[k]?.[lang] ?? k;
  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>;
}

export const useI18n = () => useContext(I18nCtx);
