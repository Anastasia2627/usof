import React from 'react';
import { Icon } from '../ui.jsx';
import { LANGUAGE_NAMES, usePreferences } from '../preferences.jsx';

export default function SettingsPage() {
  const { theme, language, setTheme, setLanguage, t } = usePreferences();

  return <main className="simpleFeaturePage settingsPage circleSettingsPage">
    <header className="circleSettingsHeader">
      <h1><Icon name="settings" size={28}/>{t('Settings')}</h1>
    </header>

    <div className="circleSettingsSections">
      <section className="circleSettingsRow" aria-labelledby="circle-settings-theme">
        <div className="circleSettingsRowHeading">
          <h2 id="circle-settings-theme">{t('App appearance')}</h2>
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
    </div>
  </main>;
}
