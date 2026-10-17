import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const KEY = 'circle-display-preferences-v1';
const LANGUAGE_NAMES = { en: 'English', uk: 'Українська', ru: 'Русский' };

const translations = {
  uk: {
    'Home':'Головна', 'Explore':'Огляд', 'Search':'Пошук', 'Categories':'Категорії',
    'New post':'Новий допис', 'Admin':'Адміністрування', 'Saved':'Збережене',
    'Dashboard':'Статистика', 'Settings':'Налаштування', 'Log in':'Увійти',
    'Sign up':'Реєстрація', 'Log out':'Вийти', 'My profile':'Мій профіль',
    'Account menu':'Меню акаунта', 'Popular':'Популярні', 'Latest':'Нові',
    'Filters':'Фільтри', 'More':'Ще', 'All':'Усі', 'All categories':'Усі категорії',
    'Apply':'Застосувати', 'Clear all':'Очистити', 'Fine-tune your feed':'Налаштувати стрічку',
    'Sort by':'Сортувати за', 'Direction':'Напрямок', 'Category':'Категорія', 'Status':'Статус',
    'Date range':'Період', 'Optional':'Необов’язково', 'From':'Від', 'To':'До',
    'Number of likes':'Кількістю вподобань', 'Publication date':'Датою публікації',
    'Descending':'За спаданням', 'Ascending':'За зростанням',
    'All viewable':'Усі доступні', 'Active':'Активні', 'Inactive':'Неактивні',
    "What's on your mind?":'Про що думаєте?', 'Post':'Опублікувати',
    'Loading conversations…':'Завантажуємо дописи…',
    'No conversations found. Try changing your filters.':'Нічого не знайдено. Спробуйте інші фільтри.',
    'Previous':'Назад', 'Next':'Далі', 'Page':'Сторінка', 'of':'з',
    'Like':'Подобається', 'Dislike':'Не подобається', 'Comment':'Коментувати',
    'View replies':'Переглянути відповіді', 'Save post':'Зберегти допис',
    'Unsave post':'Прибрати зі збереженого', 'Save':'Зберегти', 'Saved posts':'Збережені дописи',
    'Your saved posts, all in one place.':'Усі збережені дописи в одному місці.',
    'Nothing saved yet':'Ще нічого не збережено',
    'Save posts from the feed to find them here.':'Зберігайте дописи зі стрічки, щоб знайти їх тут.',
    'Your activity':'Ваша активність', 'Overview':'Огляд',
    'Posts':'Дописи', 'Replies':'Відповіді', 'Reputation':'Репутація',
    'Received likes':'Отримані вподобання', 'Following':'Відстежувані',
    'Weekly goal':'Мета на тиждень', 'Achievements':'Досягнення',
    'Community':'Спільнота', 'Activity':'Активність', 'Statistics':'Статистика',
    'Admin overview':'Статистика спільноти', 'New members':'Нові учасники',
    'Comments':'Коментарі', 'Reactions':'Реакції',
    'App appearance':'Вигляд застосунку', 'Theme':'Тема', 'Light':'Світла',
    'Dark':'Темна', 'Language':'Мова', 'Display settings':'Налаштування вигляду',
    'The changes are saved on this device.':'Зміни зберігаються на цьому пристрої.',
    'Theme and language update instantly.':'Тема та мова змінюються одразу.',
    'Post actions':'Дії з дописом', 'Open post':'Відкрити допис',
    'Deactivate':'Деактивувати', 'Activate':'Активувати',
    'Lock':'Заблокувати', 'Unlock':'Розблокувати', 'Delete':'Видалити',
    'Delete post?':'Видалити допис?', 'Moderation':'Модерація',
    'Remove from saved':'Прибрати зі збереженого', 'No data yet':'Поки немає даних',
    'Loading…':'Завантаження…', 'Try again':'Спробувати ще раз',
    'Members':'Учасники', 'Topics':'Теми', 'Delete post':'Видалити допис',
    'Edit profile':'Редагувати профіль', 'Your posts':'Ваші дописи',
    'Recent':'Останні', 'All posts':'Усі дописи', 'Write your first post':'Написати перший допис',
    'Profile':'Профіль', 'Close editor':'Закрити редактор',
    'My posts':'Мої дописи', 'You must sign in to save posts.':'Увійдіть, щоб зберігати дописи.',
    'A place for real conversations':'Місце для справжніх розмов',
    'Talk about what matters.':'Говоріть про важливе.',
  },
  ru: {
    'Home':'Главная', 'Explore':'Обзор', 'Search':'Поиск', 'Categories':'Категории',
    'New post':'Новый пост', 'Admin':'Админка', 'Saved':'Сохранённое',
    'Dashboard':'Статистика', 'Settings':'Настройки', 'Log in':'Войти',
    'Sign up':'Регистрация', 'Log out':'Выйти', 'My profile':'Мой профиль',
    'Account menu':'Меню аккаунта', 'Popular':'Популярные', 'Latest':'Новые',
    'Filters':'Фильтры', 'More':'Ещё', 'All':'Все', 'All categories':'Все категории',
    'Apply':'Применить', 'Clear all':'Очистить', 'Fine-tune your feed':'Настроить ленту',
    'Sort by':'Сортировка', 'Direction':'Направление', 'Category':'Категория', 'Status':'Статус',
    'Date range':'Период', 'Optional':'Необязательно', 'From':'От', 'To':'До',
    'Number of likes':'По лайкам', 'Publication date':'По дате',
    'Descending':'По убыванию', 'Ascending':'По возрастанию',
    'All viewable':'Все доступные', 'Active':'Активные', 'Inactive':'Неактивные',
    "What's on your mind?":'О чём думаете?', 'Post':'Опубликовать',
    'Loading conversations…':'Загружаем посты…',
    'No conversations found. Try changing your filters.':'Ничего не найдено. Попробуйте другие фильтры.',
    'Previous':'Назад', 'Next':'Вперёд', 'Page':'Страница', 'of':'из',
    'Like':'Нравится', 'Dislike':'Не нравится', 'Comment':'Комментировать',
    'View replies':'Посмотреть ответы', 'Save post':'Сохранить пост',
    'Unsave post':'Убрать из сохранённого', 'Save':'Сохранить', 'Saved posts':'Сохранённые посты',
    'Your saved posts, all in one place.':'Все сохранённые посты в одном месте.',
    'Nothing saved yet':'Пока ничего не сохранено',
    'Save posts from the feed to find them here.':'Сохраняйте посты из ленты, чтобы найти их здесь.',
    'Your activity':'Ваша активность', 'Overview':'Обзор',
    'Posts':'Посты', 'Replies':'Ответы', 'Reputation':'Репутация',
    'Received likes':'Полученные лайки', 'Following':'Подписки',
    'Weekly goal':'Цель на неделю', 'Achievements':'Достижения',
    'Community':'Сообщество', 'Activity':'Активность', 'Statistics':'Статистика',
    'Admin overview':'Статистика сообщества', 'New members':'Новые участники',
    'Comments':'Комментарии', 'Reactions':'Реакции',
    'App appearance':'Вид приложения', 'Theme':'Тема', 'Light':'Светлая',
    'Dark':'Тёмная', 'Language':'Язык', 'Display settings':'Настройки оформления',
    'The changes are saved on this device.':'Изменения сохраняются на этом устройстве.',
    'Theme and language update instantly.':'Тема и язык меняются сразу.',
    'Post actions':'Действия с постом', 'Open post':'Открыть пост',
    'Deactivate':'Деактивировать', 'Activate':'Активировать',
    'Lock':'Заблокировать', 'Unlock':'Разблокировать', 'Delete':'Удалить',
    'Delete post?':'Удалить пост?', 'Moderation':'Модерация',
    'Remove from saved':'Убрать из сохранённого', 'No data yet':'Пока нет данных',
    'Loading…':'Загрузка…', 'Try again':'Повторить',
    'Members':'Участники', 'Topics':'Темы', 'Delete post':'Удалить пост',
    'Edit profile':'Редактировать профиль', 'Your posts':'Ваши посты',
    'Recent':'Недавние', 'All posts':'Все посты', 'Write your first post':'Написать первый пост',
    'Profile':'Профиль', 'Close editor':'Закрыть редактор',
    'My posts':'Мои посты', 'You must sign in to save posts.':'Войдите, чтобы сохранять посты.',
    'A place for real conversations':'Место для настоящих разговоров',
    'Talk about what matters.':'Говорите о важном.',
  },
};
const PreferencesContext = createContext(null);
function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      theme: saved.theme === 'dark' ? 'dark' : 'light',
      language: Object.hasOwn(LANGUAGE_NAMES, saved.language) ? saved.language : 'en',
    };
  } catch { return { theme:'light',language:'en' }; }
}

export function PreferencesProvider({ children }) {
  const [prefs, setPrefs] = useState(read);
  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
    document.documentElement.lang = prefs.language;
    document.documentElement.style.colorScheme = prefs.theme;
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {}
  }, [prefs]);

  const value = useMemo(() => ({
    ...prefs,
    setTheme: theme => setPrefs(prev => ({ ...prev, theme: theme === 'dark' ? 'dark' : 'light' })),
    setLanguage: language => setPrefs(prev => ({ ...prev, language: Object.hasOwn(LANGUAGE_NAMES,language) ? language : 'en' })),
    t: english => translations[prefs.language]?.[english] || english,
  }), [prefs]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const prefs = useContext(PreferencesContext);
  if (!prefs) throw new Error('PreferencesProvider missing');
  return prefs;
}
export { LANGUAGE_NAMES };
