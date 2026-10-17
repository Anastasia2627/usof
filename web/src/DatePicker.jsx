import React,{useEffect,useMemo,useRef,useState} from 'react';
import {usePreferences} from './preferences.jsx';
import TablerIcon from './TablerIcon.jsx';

const pad=n=>String(n).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
function parseDate(text){
  const match=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(text||''));
  if(!match)return null;
  const date=new Date(+match[1],+match[2]-1,+match[3],12);
  return date.getMonth()===+match[2]-1&&date.getDate()===+match[3]?date:null;
}
/** Calendar built with Tabler controls, not the browser's native date popup.
 * The backend continues to receive ordinary ISO dates and local datetimes. */
export default function DatePicker({value='',onChange,mode='date',id,label,placeholder}) {
  const {language,t}=usePreferences();
  const [open,setOpen]=useState(false);
  const selected=parseDate(value);
  const [month,setMonth]=useState(()=>selected||new Date());
  const wrap=useRef(null);
  const locale=language==='uk'?'uk-UA':'en-US';
  useEffect(()=>{
    if(!open)return;
    const outside=e=>{if(!wrap.current?.contains(e.target))setOpen(false);};
    const escape=e=>{if(e.key==='Escape')setOpen(false);};
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[open]);
  const days=useMemo(()=>{
    const first=new Date(month.getFullYear(),month.getMonth(),1,12);
    const shift=(first.getDay()+6)%7;
    return Array.from({length:Math.ceil((shift+new Date(month.getFullYear(),month.getMonth()+1,0).getDate())/7)*7},
      (_,index)=>{
        const date=new Date(month.getFullYear(),month.getMonth(),1-shift+index,12);
        return {date,inside:date.getMonth()===month.getMonth()};
      });
  },[month]);
  const time=/T(\d{2}):(\d{2})/.exec(value||'');
  const hour=time?.[1]||'12',minute=time?.[2]||'00';
  const display=selected?new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'numeric'}).format(selected):null;
  const emitDate=date=>{
    const next=ymd(date);
    onChange(mode==='datetime'?next+'T'+hour+':'+minute:next);
    setMonth(date);setOpen(false);
  };
  const setTime=(h,m)=>{
    if(!selected)return;
    onChange(ymd(selected)+'T'+h+':'+m);
  };
  return <div className={'circleDatePicker'+(open?' isOpen':'')} ref={wrap}>
    <button id={id} type="button" className="circleDateTrigger" aria-label={label||t('Pick a date')}
      aria-haspopup="dialog" aria-expanded={open} title={t('Pick a date')}
      onClick={()=>{setMonth(selected||new Date());setOpen(v=>!v);}}>
      <TablerIcon name="calendar" size={19}/>
      <span className={!selected?'datePlaceholder':''}>{display||placeholder||t('Pick a date')}</span>
      {selected&&<TablerIcon name="chevron" size={16}/>}
    </button>
    {mode==='datetime'&&selected&&<div className="calendarTime" aria-label={t('Choose a time')}>
      <select aria-label="Hour" value={hour} onChange={e=>setTime(e.target.value,minute)}>
        {Array.from({length:24},(_,i)=><option value={pad(i)} key={i}>{pad(i)}</option>)}
      </select><span>:</span>
      <select aria-label="Minute" value={minute} onChange={e=>setTime(hour,e.target.value)}>
        {Array.from({length:60},(_,i)=><option value={pad(i)} key={i}>{pad(i)}</option>)}
      </select>
    </div>}
    {open&&<div className="circleCalendar" role="dialog" aria-label={label||t('Pick a date')}>
      <div className="calendarHeading">
        <strong>{new Intl.DateTimeFormat(locale,{month:'long',year:'numeric'}).format(month)}</strong>
        <div>
          <button type="button" title={t('Previous month')} aria-label={t('Previous month')} onClick={()=>setMonth(d=>new Date(d.getFullYear(),d.getMonth()-1,1,12))}><TablerIcon name="arrowBack" size={18}/></button>
          <button type="button" title={t('Next month')} aria-label={t('Next month')} onClick={()=>setMonth(d=>new Date(d.getFullYear(),d.getMonth()+1,1,12))}><TablerIcon name="arrow" size={18}/></button>
        </div>
      </div>
      <div className="calendarGrid" role="grid">
        {Array.from({length:7},(_,n)=>{
          const monday=new Date(2026,9,12+n,12);
          return <span className="weekday" key={n}>{new Intl.DateTimeFormat(locale,{weekday:'short'}).format(monday)}</span>;
        })}
        {days.map(({date,inside})=><button type="button" className={[
          'calendarDay',!inside?'outsideMonth':'',
          selected&&ymd(date)===ymd(selected)?'selected':'',
          ymd(date)===ymd(new Date())?'today':''].join(' ')}
          key={ymd(date)} aria-label={new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric'}).format(date)}
          aria-pressed={Boolean(selected&&ymd(date)===ymd(selected))}
          onClick={()=>emitDate(date)}>{date.getDate()}</button>)}
      </div>
      <div className="calendarFooter">
        <button type="button" onClick={()=>{onChange('');setOpen(false);}}>{t('Clear date')}</button>
        <button type="button" onClick={()=>emitDate(new Date())}>{t('Today')}</button>
      </div>
    </div>}
  </div>;
}
