import { render } from 'preact';
import '@fontsource/anuphan/600.css';
import '@fontsource/anuphan/700.css';
import '@fontsource/ibm-plex-sans-thai/400.css';
import '@fontsource/ibm-plex-sans-thai/600.css';
import '@fontsource/sarabun/400.css';
import '@fontsource/sarabun/600.css';
import '@fontsource/noto-serif-thai/700.css';
import './styles/base.css';
import { App } from './App.tsx';

const q = new URLSearchParams(location.search);
render(<App fixture={q.get('fixture')} initialTab={q.get('tab') ?? 'desk'} />, document.getElementById('app') as HTMLElement);
