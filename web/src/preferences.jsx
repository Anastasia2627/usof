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

Object.assign(translations.uk, {
  'Administrator':'Адміністратор', 'Circle member':'Учасник Circle',
  'Username':'Логін','Full name':'Повне ім’я','Change profile photo':'Змінити фото',
  'Uploading photo…':'Завантажуємо фото…','Profile saved.':'Профіль збережено.',
  'Avatar updated.':'Фото оновлено.','Cancel':'Скасувати','Save profile':'Зберегти профіль',
  'Loading posts…':'Завантажуємо дописи…','Nothing here yet':'Поки тут порожньо',
  'Try another topic or status.':'Оберіть іншу тему або статус.',
  'Your conversations will appear here.':'Тут з’являться ваші дописи.',
  'This member has not posted yet.':'Цей учасник ще нічого не опублікував.',
  'Account settings':'Налаштування акаунта','Delete account':'Видалити акаунт',
  'Deleting your account permanently removes your posts, comments and reactions.':'Видалення акаунта назавжди видалить дописи, коментарі й реакції.',
  'Changing your username will sign you out. You can log in again with the new username.':'Після зміни логіна потрібно буде увійти знову.',
  'Log in to view your profile.':'Увійдіть, щоб переглянути профіль.',
  'Post title':'Назва допису','Post details':'Текст допису',
  'Give your post a title…':'Дайте назву допису…','Posting to Circle':'Публікація в Circle',
  'Choose one or more':'Оберіть одну або кілька','Saving…':'Зберігаємо…',
  'Publish post':'Опублікувати','Save changes':'Зберегти зміни',
  'Edit post':'Редагувати допис','Loading editor…':'Завантажуємо редактор…',
  'Select at least one category.':'Оберіть хоча б одну категорію.',
  'Select a topic to continue':'Оберіть тему для продовження',
  'selected':'вибрано','topic':'тему','topics':'теми',
  'Log in to create or edit posts.':'Увійдіть, щоб писати та редагувати дописи.'
});
Object.assign(translations.ru, {
  'Administrator':'Администратор','Circle member':'Участник Circle',
  'Username':'Логин','Full name':'Полное имя','Change profile photo':'Изменить фото',
  'Uploading photo…':'Загружаем фото…','Profile saved.':'Профиль сохранён.',
  'Avatar updated.':'Фото обновлено.','Cancel':'Отмена','Save profile':'Сохранить профиль',
  'Loading posts…':'Загружаем посты…','Nothing here yet':'Пока здесь пусто',
  'Try another topic or status.':'Выберите другую тему или статус.',
  'Your conversations will appear here.':'Здесь появятся ваши посты.',
  'This member has not posted yet.':'Этот участник ещё ничего не опубликовал.',
  'Account settings':'Настройки аккаунта','Delete account':'Удалить аккаунт',
  'Deleting your account permanently removes your posts, comments and reactions.':'Удаление аккаунта навсегда удалит посты, комментарии и реакции.',
  'Changing your username will sign you out. You can log in again with the new username.':'После изменения логина нужно будет войти снова.',
  'Log in to view your profile.':'Войдите, чтобы посмотреть профиль.',
  'Post title':'Название поста','Post details':'Текст поста',
  'Give your post a title…':'Придумайте название поста…','Posting to Circle':'Публикация в Circle',
  'Choose one or more':'Выберите одну или несколько','Saving…':'Сохраняем…',
  'Publish post':'Опубликовать','Save changes':'Сохранить изменения',
  'Edit post':'Редактировать пост','Loading editor…':'Загружаем редактор…',
  'Select at least one category.':'Выберите хотя бы одну категорию.',
  'Select a topic to continue':'Выберите тему для продолжения',
  'selected':'выбрано','topic':'тема','topics':'темы',
  'Log in to create or edit posts.':'Войдите, чтобы писать и редактировать посты.'
});

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
