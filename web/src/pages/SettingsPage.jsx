import React from 'react';
import { Icon, go } from '../ui.jsx';
import { LANGUAGE_NAMES, usePreferences } from '../preferences.jsx';

export default function SettingsPage() {
  const { theme, language, setTheme, setLanguage, t } = usePreferences();
  const uk=language==='uk';

  return <main className="simpleFeaturePage settingsPage circleSettingsPage">
    <header className="circleSettingsHeader">
      <h1>{t('Settings')}</h1>
      <span className="circleSettingsHeaderSymbol" aria-hidden="true">
        <Icon name="settings" size={24}/>
      </span>
    </header>

    <div className="circleSettingsSections">
      <section className="circleSettingsRow" aria-labelledby="circle-settings-theme">
        <div className="circleSettingsRowHeading">
          <h2 id="circle-settings-theme">{t('App appearance')}</h2>
          <small>{uk?'Світла чи темна':'Light or dark'}</small>
        </div>
        <div className="circleSettingsThemeOptions" role="radiogroup" aria-label={t('App appearance')}>
          {['light', 'dark'].map(value => (
            <button key={value} type="button" role="radio"
              aria-checked={theme === value}
              className={`circleSettingsOption${theme === value ? ' isSelected' : ''}`}
              onClick={() => setTheme(value)}>
              <Icon name={value === 'dark' ? 'dark' : 'light'} size={21}/>
              <span>{t(value === 'dark' ? 'Dark' : 'Light')}</span>
              {theme === value && <Icon name="check" size={17}/>}
            </button>
          ))}
        </div>
      </section>

      <section className="circleSettingsRow" aria-labelledby="circle-settings-language">
        <div className="circleSettingsRowHeading">
          <h2 id="circle-settings-language">{t('Language')}</h2>
          <small>{uk?'Мова інтерфейсу':'Interface language'}</small>
        </div>
        <div className="circleSettingsLanguageOptions" role="radiogroup" aria-label={t('Language')}>
          {Object.entries(LANGUAGE_NAMES).map(([value, label]) => (
            <button key={value} type="button" role="radio"
              aria-checked={language === value}
              className={`circleSettingsLanguageOption${language === value ? ' isSelected' : ''}`}
              onClick={() => setLanguage(value)}>
              <span>{label}</span>
              <span className="circleSettingsRadio" aria-hidden="true">
                {language === value && <Icon name="check" size={15}/>}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="circleSettingsRow" aria-labelledby="circle-settings-interests">
        <div className="circleSettingsRowHeading">
          <h2 id="circle-settings-interests">{uk?'Мої теми':'My interests'}</h2>
          <small>{uk?'Вибір тем для стрічки':'Feed preferences'}</small>
        </div>
        <button type="button" className="circleSettingsInterestsLink" onClick={()=>go('/categories')}>
          <Icon name="categories" size={19}/>
          <span>{uk?'Налаштувати теми стрічки':'Customize feed topics'}</span>
          <Icon name="arrow" size={17}/>
        </button>
      </section>
    </div>
  </main>;
}
