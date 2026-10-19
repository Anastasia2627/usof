import React from 'react';
import {Icon,go} from '../ui.jsx';
import {usePreferences} from '../preferences.jsx';

// Product-style editorial collage. Images degrade to color treatments offline.
const photos=[
  'https://images.pexels.com/photos/35998079/pexels-photo-35998079.jpeg?auto=compress&cs=tinysrgb&w=850',
  'https://images.pexels.com/photos/8973446/pexels-photo-8973446.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/14886151/pexels-photo-14886151.jpeg?auto=compress&cs=tinysrgb&w=800',
];
export default function WelcomePage(){
  const {language}=usePreferences();
  const uk=language==='uk';
  return <main className="welcomePage welcomeEditorial">
    <section className="welcomeHero welcomeCinematic">
      <div className="welcomeCinematicGrid">
        <div className="welcomeCinematicCopy">
          <h1>{uk?<>Знайди своїх.<span>Поділися ідеями.</span><em>Будь собою.</em></>:<>Find your people.<span>Share your ideas.</span><em>Be yourself.</em></>}</h1>
          <p className="welcomeLead">{uk?
            'Обговорюй улюблене, знаходь однодумців і відкривай нові погляди у Circle.':
            'Share what you love, find like-minded people, and discover fresh perspectives on Circle.'}</p>
          <div className="welcomeButtons">
            <button className="primary welcomePrimary" onClick={()=>go('/register')}>
              {uk?'Приєднатися':'Join Circle'} <Icon name="arrow" size={19}/>
            </button>
            <button className="welcomeSecondary" onClick={()=>go('/explore')}>
              {uk?'Переглянути дописи':'Explore posts'} <Icon name="arrow" size={17}/>
            </button>
          </div>
          <p className="welcomeBrowse">{uk?'Уже маєш акаунт?':'Already have an account?'}{' '}
            <button onClick={()=>go('/login')}>{uk?'Увійти':'Log in'}</button>
          </p>
        </div>
        <div className="welcomeCinematicVisual" aria-hidden="true">
          <span className="welcomeVisualGlow"/>
          <span className="welcomeVisualWord">circle</span>
          <div className="welcomeFloatingCard welcomeFloatingCardA">
            <img src={photos[0]} alt="" loading="lazy"/>
            <span className="welcomeFloatingLabel">Create <b>↗</b></span>
          </div>
          <div className="welcomeFloatingCard welcomeFloatingCardB">
            <img src={photos[1]} alt="" loading="lazy"/>
            <span className="welcomeFloatingLabel">Connect <b>✳</b></span>
          </div>
          <div className="welcomeFloatingCard welcomeFloatingCardC">
            <img src={photos[2]} alt="" loading="lazy"/>
            <span className="welcomeFloatingLabel">Discover <b>◎</b></span>
          </div>
          <span className="welcomeGlassRing welcomeGlassRingOne"/><span className="welcomeGlassRing welcomeGlassRingTwo"/>
        </div>
      </div>
    </section>
  </main>;
}
