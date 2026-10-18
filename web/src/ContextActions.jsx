import React,{useEffect,useRef,useState} from 'react';
import {Icon} from './ui.jsx';

/** Right-click, keyboard context-key and an accessible ellipsis share one menu. */
export function useContextActions(){
  const [position,setPosition]=useState(null);
  const menuRef=useRef(null);
  const close=()=>setPosition(null);
  function open(event){
    event.preventDefault();
    event.stopPropagation();
    const box=event.currentTarget.getBoundingClientRect();
    const fromPointer=event.type==='contextmenu' && !(event.detail===0);
    const x=fromPointer ? event.clientX : box.right-15;
    const y=fromPointer ? event.clientY : box.bottom;
    setPosition({
      x:Math.max(8,Math.min(x,window.innerWidth-243)),
      y:Math.max(8,Math.min(y,window.innerHeight-280)),
    });
  }
  useEffect(()=>{
    if(!position)return;
    function outside(e){if(!menuRef.current?.contains(e.target))close();}
    function keyboard(e){if(e.key==='Escape')close();}
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',keyboard);
    return()=>{
      document.removeEventListener('pointerdown',outside);
      document.removeEventListener('keydown',keyboard);
    };
  },[position]);
  return {position,open,close,menuRef};
}

export function ContextActions({menu,items,label}){
  if(!menu.position || !items.length)return null;
  return <div className="discussionActionMenu" role="menu" aria-label={label}
    ref={menu.menuRef} style={{left:menu.position.x,top:menu.position.y}}>
    {items.map((item,i)=>item.separator
      ? <div className="discussionActionDivider" role="separator" key={'sep'+i}/>
      : <button key={item.key||i} type="button" role="menuitem"
          className={item.danger?'discussionActionDanger':''}
          onClick={()=>{
            menu.close();
            item.action();
          }}>
          <Icon name={item.icon} size={18}/>
          <span>{item.label}</span>
        </button>
    )}
  </div>;
}
