import React, { createContext, useContext, useMemo, useState } from 'react';

const dictionaries = {
  en: {
    brandTagline: 'A place for conversations',
    home: 'Home',
    explore: 'Explore',
    following: 'Following',
    saved: 'Saved',
    messages: 'Messages',
    dashboard: 'Dashboard',
    admin: 'Admin',
    startThread: 'Start a thread',
    login: 'Log in',
    signup: 'Sign up',
    logout: 'Log out',
    search: 'Search people, threads, topics…',
    heroEyebrow: 'What people are talking about right now',
    heroTitle: "What's everyone talking about?",
    heroBody: 'Drop in, catch up, tell your side, stay for the conversation',
    latest: 'Latest',
    popular: 'Popular',
    evening: 'Evening recap',
    forYou: 'For you',
    filters: 'Filters',
    apply: 'Apply',
    allTopics: 'All topics',
    createAccount: 'Create your account',
    welcomeBack: 'Welcome back',
    joinCopy: 'Your seat is open',
    loginCopy: 'See what you missed',
    username: 'Username',
    fullName: 'Full name',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm password',
    continueGoogle: 'Continue with Google',
    create: 'Create account',
    working: 'One moment…',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    checkInbox: 'Check your inbox',
    verifyCopy: 'We sent a verification link to your email. Open it to join Circle',
    verifyCodeLabel: 'Verification code',
    verify: 'Verify email',
    verifying: 'Verifying…',
    verified: 'You’re in',
    continueLogin: 'Continue to login',
    noThreads: 'No threads here yet',
    noThreadsBody: 'Try another filter, or start the conversation yourself',
  },
  uk: {
    brandTagline: 'Місце для розмов',
    home: 'Головна',
    explore: 'Огляд',
    following: 'Підписки',
    saved: 'Збережене',
    messages: 'Повідомлення',
    dashboard: 'Статистика',
    admin: 'Адмін',
    startThread: 'Створити тред',
    login: 'Увійти',
    signup: 'Реєстрація',
    logout: 'Вийти',
    search: 'Пошук людей, тредів і тем…',
    heroEyebrow: 'Про що люди говорять прямо зараз',
    heroTitle: 'Що всі сьогодні обговорюють?',
    heroBody: 'Зазирни, наздожени новини, розкажи своє й залишайся заради розмови',
    latest: 'Нові',
    popular: 'Популярні',
    evening: 'Вечірній дайджест',
    forYou: 'Для тебе',
    filters: 'Фільтри',
    apply: 'Застосувати',
    allTopics: 'Усі теми',
    createAccount: 'Створи акаунт',
    welcomeBack: 'З поверненням',
    joinCopy: 'Твоє місце вільне',
    loginCopy: 'Подивись, що ти пропустила',
    username: 'Нікнейм',
    fullName: 'Ім’я',
    email: 'Email',
    password: 'Пароль',
    confirmPassword: 'Повтори пароль',
    continueGoogle: 'Продовжити з Google',
    create: 'Створити акаунт',
    working: 'Секунду…',
    showPassword: 'Показати пароль',
    hidePassword: 'Сховати пароль',
    checkInbox: 'Перевір пошту',
    verifyCopy: 'Ми надіслали посилання для підтвердження. Відкрий його, щоб приєднатися до Circle',
    verifyCodeLabel: 'Код підтвердження',
    verify: 'Підтвердити email',
    verifying: 'Перевіряємо…',
    verified: 'Готово',
    continueLogin: 'Перейти до входу',
    noThreads: 'Тут поки немає тредів',
    noThreadsBody: 'Спробуй інший фільтр або почни розмову сама',
  },
};

const LanguageContext = createContext(null);

function initialLanguage() {
  const stored = localStorage.getItem('circle-language');
  if (stored && dictionaries[stored]) return stored;
  return navigator.language?.toLowerCase().startsWith('uk') ? 'uk' : 'en';
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(initialLanguage);

  const value = useMemo(() => ({
    language,
    setLanguage(next) {
      if (!dictionaries[next]) return;
      localStorage.setItem('circle-language', next);
      document.documentElement.lang = next;
      setLanguageState(next);
    },
    t(key) {
      return dictionaries[language]?.[key] ?? dictionaries.en[key] ?? key;
    },
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useI18n must be used inside LanguageProvider');
  return value;
}
