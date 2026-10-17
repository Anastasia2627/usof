import React from 'react';
import { Icon } from '../ui.jsx';
import { LANGUAGE_NAMES, usePreferences } from '../preferences.jsx';

export default function SettingsPage() {
  const { theme, language, setTheme, setLanguage, t } = usePreferences();
  return <main className="simpleFeaturePage settingsPage">
    <div className="featureHeading"><Icon name="settings" size={27}/><h1>{t('Settings')}</h1></div>
    <section className="settingsSection">
      <h2>{t('App appearance')}</h2>
      <div className="settingsChoices" role="radiogroup" aria-label={t("App appearance")}>
        {['light','dark'].map(value=><button type="button" role="radio" aria-checked={theme===value}
          key={value} className={theme===value?'settingsSelected':''} onClick={()=>setTheme(value)}>
          <Icon name={value==='dark'?'dark':'light'} size={23}/>
          <span>{t(value==='dark'?'Dark':'Light')}</span>
          {theme===value&&<Icon name="check" size={18}/>}
        </button>)}
      </div>
    </section>
    <section className="settingsSection">
      <h2>{t('Language')}</h2>
      <div className="settingsChoices settingsLanguages" role="radiogroup" aria-label={t("Language")}>
        {Object.entries(LANGUAGE_NAMES).map(([value,label])=><button type="button"
          key={value} role="radio" aria-checked={language===value}
          className={language===value?'settingsSelected':''} onClick={()=>setLanguage(value)}>
          <Icon name="language" size={22}/><span>{label}</span>
          {language===value&&<Icon name="check" size={18}/>}
        </button>)}
      </div>
    </section>
  </main>;
}
