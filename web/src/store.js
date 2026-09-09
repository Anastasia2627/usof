import {createStore} from 'redux';
const saved=JSON.parse(localStorage.getItem('usof-auth')||'null');
const initial={auth:saved,notice:null};
function reducer(state=initial,action){switch(action.type){case'AUTH_SET':localStorage.setItem('usof-auth',JSON.stringify(action.payload));return{...state,auth:action.payload};case'AUTH_CLEAR':localStorage.removeItem('usof-auth');return{...state,auth:null};case'NOTICE':return{...state,notice:action.payload};default:return state;}}
export const store=createStore(reducer);
