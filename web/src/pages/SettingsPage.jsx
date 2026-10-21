import React from 'react';
import { Icon } from '../ui.jsx';
import { LANGUAGE_NAMES, usePreferences } from '../preferences.jsx';

export default function SettingsPage() {
  const { theme, language, setTheme, setLanguage, t } = usePreferences();
  const uk = language === 'uk';

  return <main className="simpleFeaturePage settingsPage circleSettingsPage">
    <header className="circleSettingsHeader">
      <div className="circleSettingsKicker"><span aria-hidden="true"/> CIRCLE / {uk ? 'ПЕРСОНАЛІЗАЦІЯ' : 'PERSONALIZATION'}</div>
      <h1>{t('Settings')}</h1>
      <p>{uk ? 'Зробіть Circle зручним для себе.' : 'Make Circle feel right for you.'}</p>
    </header>

    <div className="circleSettingsLayout">
      <div className="circleSettingsControls">
        <section className="circleSettingsGroup" aria-labelledby="settings-appearance">
          <div className="circleSettingsGroupTitle">
            <span className="circleSettingsIndex">01</span>
            <div>
              <h2 id="settings-appearance">{t('App appearance')}</h2>
              <p>{uk ? 'Оберіть оформлення інтерфейсу' : 'Choose your interface style'}</p>
            </div>
          </div>
          <div className="circleSettingsThemeGrid" role="radiogroup" aria-label={t('App appearance')}>
            {['light','dark'].map(value=><button key={value} type="button" role="radio"
              aria-checked={theme===value} onClick={()=>setTheme(value)}
              className={`circleSettingsThemeChoice${theme===value?' isSelected':''}`}>
              <span className={`circleSettingsThemeScene ${value==='dark'?'themeNight':'themeDay'}`} aria-hidden="true">
                <span className="sceneHeader"><i/><b/><i/></span>
                <span className="sceneBody">
                  <span className="sceneSide"><i/><i/><i/></span>
                  <span className="scenePosts"><i/><i/><i/></span>
                </span>
              </span>
              <span className="circleSettingsChoiceInfo">
                <Icon name={value==='dark'?'dark':'light'} size={19}/>
                <strong>{t(value==='dark'?'Dark':'Light')}</strong>
                <span className="circleSettingsChoiceCheck" aria-hidden="true">
                  {theme===value && <Icon name="check" size={15}/>}
                </span>
              </span>
            </button>)}
          </div>
        </section>

        <section className="circleSettingsGroup" aria-labelledby="settings-language">
          <div className="circleSettingsGroupTitle">
            <span className="circleSettingsIndex">02</span>
            <div>
              <h2 id="settings-language">{t('Language')}</h2>
              <p>{uk ? 'Мова меню та інтерфейсу' : 'Language of menus and navigation'}</p>
            </div>
          </div>
          <div className="circleSettingsLanguageOptions" role="radiogroup" aria-label={t('Language')}>
            {Object.entries(LANGUAGE_NAMES).map(([value,label])=><button type="button" key={value}
              role="radio" aria-checked={language===value} onClick={()=>setLanguage(value)}
              className={`circleSettingsLanguageChoice${language===value?' isSelected':''}`}>
              <span className="circleSettingsLangTag">{value.toUpperCase()}</span>
              <span>{label}</span>
              <span className="circleSettingsChoiceCheck" aria-hidden="true">
                {language===value && <Icon name="check" size={16}/>}
              </span>
            </button>)}
          </div>
        </section>
      </div>

      <aside className="circleSettingsPreviewPanel" aria-label={uk?'Попередній перегляд':'Preview'}>
        <div className="circleSettingsPreviewHeading">
          <span>{uk?'ПОПЕРЕДНІЙ ПЕРЕГЛЯД':'LIVE PREVIEW'}</span>
          <span className="circleSettingsLiveDot" aria-hidden="true"/>
        </div>
        <div className={`circleSettingsPreviewCanvas${theme==='dark'?' isDark':''}`} aria-hidden="true">
          <div className="circleSettingsPreviewBrowser">
            <div className="circleSettingsMiniLogo"><i/> circle</div>
            <div className="circleSettingsMiniSearch"/>
            <div className="circleSettingsMiniAvatar"/>
          </div>
          <div className="circleSettingsMiniBody">
            <div className="circleSettingsMiniSidebar"><i/><i/><i/><i/></div>
            <div className="circleSettingsMiniFeed">
              <span className="circleSettingsMiniTitle">{uk?'Головна':'Home'}</span>
              <span className="circleSettingsMiniTabs"><i/><i/><i/></span>
              <span className="circleSettingsMiniPost">
                <span className="circleSettingsMiniAuthor"><i/><b/></span>
                <span className="circleSettingsMiniText"/><span className="circleSettingsMiniText short"/>
                <span className="circleSettingsMiniPicture"/>
              </span>
              <span className="circleSettingsMiniPost lower">
                <span className="circleSettingsMiniAuthor"><i/><b/></span>
                <span className="circleSettingsMiniText"/>
              </span>
            </div>
          </div>
        </div>
        <p>{uk?'Зміни зберігаються автоматично.':'Changes are saved automatically.'}</p>
      </aside>
    </div>
  </main>;
}
