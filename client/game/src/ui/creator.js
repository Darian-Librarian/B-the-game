import { AuthLogic } from './creator-logic.js?v=new-engine-311';
import { initSelection } from './selection.js?v=new-engine-311';
import { AuthUIManager } from './auth-ui.js?v=new-engine-311';
import { CharacterCreatorUIManager } from './character-creator-ui.js?v=new-engine-311';
import { InGameMenuUIManager } from './in-game-menu-ui.js?v=new-engine-311';

const applyUIScaling = () => {
  const scalers = document.querySelectorAll('.screen-scaler');
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  scalers.forEach(scaler => {
    scaler.style.transform = `translate(-50%, -50%) scale(${scale})`;
  });
};
window.addEventListener('resize', applyUIScaling);
applyUIScaling(); 

const modal = document.getElementById('custom-modal');
document.getElementById('modal-close').onclick = () => modal.style.display = 'none';

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && modal.style.display === 'flex') {
    e.preventDefault();
    document.getElementById('modal-close').click();
  }
});

const app = {
  auth: new AuthLogic(),
  currentAccount: null,
  initSelection: initSelection,
  showModal: (title, body) => {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-body').innerText = body;
    modal.style.display = 'flex';
  }
};

new AuthUIManager(app);
new CharacterCreatorUIManager(app);
new InGameMenuUIManager(app);
