export class AuthUIManager {
  constructor(app) {
    this.app = app;
    this.isSignUpMode = false;
    this.setupUI();
  }

  setupUI() {
    const btnMain = document.getElementById('btn-main');
    const togglePrompt = document.querySelector('.toggle-text');
    const emailGroup = document.getElementById('email-group');
    const btnPlay = document.getElementById('btn-play');
    const noEmailCheckbox = document.getElementById('no-email');
    const emailInput = document.getElementById('email');

    const handleToggle = () => {
      this.isSignUpMode = !this.isSignUpMode;
      if (emailGroup) emailGroup.style.display = this.isSignUpMode ? 'flex' : 'none';
      if (btnMain) btnMain.innerText = this.isSignUpMode ? 'Create Account' : 'Login';
      
      if (togglePrompt) {
        if (this.isSignUpMode) {
          togglePrompt.innerHTML = `Already Have An Account? <span id="toggle-auth">Log in!</span>`;
        } else {
          togglePrompt.innerHTML = `Don't Have An Account? <span id="toggle-auth">Sign Up!</span>`;
        }
        document.getElementById('toggle-auth').onclick = handleToggle;
      }
    };

    const toggleAuthBtn = document.getElementById('toggle-auth');
    if (toggleAuthBtn) toggleAuthBtn.onclick = handleToggle;

    const savedUsername = localStorage.getItem('b_saved_username');
    if (savedUsername) {
      const uInput = document.getElementById('username');
      if (uInput) uInput.value = savedUsername;
      const remUser = document.getElementById('remember-user');
      if (remUser) remUser.checked = true;
    }

    if (noEmailCheckbox && emailInput) {
      noEmailCheckbox.addEventListener('change', (e) => {
        emailInput.disabled = e.target.checked;
        if (e.target.checked) emailInput.value = '';
      });
    }

    const handleEnter = (e) => {
      if (e.key === 'Enter') {
        const modal = document.getElementById('custom-modal');
        if (!modal || modal.style.display !== 'flex') {
          e.preventDefault();
          if (btnMain) btnMain.click();
        }
      }
    };
    document.getElementById('username')?.addEventListener('keydown', handleEnter);
    document.getElementById('password')?.addEventListener('keydown', handleEnter);
    document.getElementById('email')?.addEventListener('keydown', handleEnter);

    if (btnMain) {
      btnMain.addEventListener('click', async () => {
        const user = document.getElementById('username').value.trim();
        const pass = document.getElementById('password').value;
        let email = document.getElementById('email') ? document.getElementById('email').value.trim() : '';
        const noEmailCheckboxEl = document.getElementById('no-email');
        const noEmail = noEmailCheckboxEl ? noEmailCheckboxEl.checked : false;

        if (!user || !pass) return this.app.showModal("Input Error", "Username and Password are required.");

        try {
          if (this.isSignUpMode) {
            if (!email || noEmail) email = '';
            const newAcc = await this.app.auth.register(user, email, pass);
            
            this.app.currentAccount = newAcc;
            localStorage.setItem('b_current_account', JSON.stringify(newAcc));
            this.app.showModal("Success", "Account created successfully! You can now log in.");
            this.app.initSelection(newAcc);
          } else {
            const result = await this.app.auth.verify(user, pass);
            if (result.success) {
              this.app.currentAccount = result.account;
              localStorage.setItem('b_current_account', JSON.stringify(result.account));
              const remUser = document.getElementById('remember-user');
              if (remUser && remUser.checked) {
                localStorage.setItem('b_saved_username', user);
              } else {
                localStorage.removeItem('b_saved_username');
              }
              
              this.app.initSelection(result.account);
            } else {
              this.app.showModal("Auth Failure", "Invalid login information.");
            }
          }
        } catch (err) {
          console.error("Auth Error:", err);
          this.app.showModal("System Error", err.message || "An Unexpected Error Occurred. Check The Console.");
        }
      });
    }

    const autoRelogChar = localStorage.getItem('b_auto_relog_char');
    const savedAccount = localStorage.getItem('b_current_account');

    if (autoRelogChar && savedAccount) {
      localStorage.removeItem('b_auto_relog_char');
      try {
        const account = JSON.parse(savedAccount);
        this.app.currentAccount = account;
        
        let selectedChar = (account.characters || []).find(c => {
          const cName = typeof c === 'object' ? c.name : c;
          return cName && cName.trim().toLowerCase() === autoRelogChar.trim().toLowerCase();
        });
        
        if (!selectedChar && account.characters && account.characters.length > 0) {
          selectedChar = typeof account.characters[0] === 'object' ? account.characters[0] : { name: account.characters[0] };
        }
        
        if (selectedChar) {
          document.getElementById('creation-screen').style.display = 'none';
          document.getElementById('selection-screen').style.display = 'none';
          document.getElementById('game-screen').style.display = 'block';
          
          import(`./game/engine.js?v=${Date.now()}`).then(module => {
            if (window.currentGameEngine) window.currentGameEngine.stop();
            window.currentGameEngine = new module.GameEngine('game-canvas', selectedChar, account.uuid);
          }).catch(err => {
            console.error("Engine Import Error:", err);
            this.app.showModal("Engine Error", "Failed to load engine.js.");
          });
        }
      } catch (e) {
        console.error("Failed to parse auto-relog data", e);
      }
    }

    if (btnPlay) {
      btnPlay.addEventListener('click', () => {
        const activeSlot = document.querySelector('.char-slot.active');
        if (!activeSlot) {
          return this.app.showModal("Selection Error", "Please select a character to play.");
        }

        const nameEl = activeSlot.querySelector('h1, h2, h3, h4, h5, h6, strong, .char-name');
        let charName = activeSlot.dataset.name;
        if (!charName) {
          if (nameEl) {
            charName = nameEl.innerText.trim();
          } else {
            charName = activeSlot.innerText.trim().split('\n')[0].trim();
          }
        }
        
        if (!this.app.currentAccount) return this.app.showModal("Data Error", "No account loaded.");

        const selectedChar = this.app.currentAccount.characters.find(c => c.name.toLowerCase() === charName.toLowerCase());
        
        if (!selectedChar) {
          return this.app.showModal("Data Error", "Could not load character data.");
        }

        document.getElementById('selection-screen').style.display = 'none';
        document.getElementById('game-screen').style.display = 'block';
        
        import(`./game/engine.js?v=${Date.now()}`).then(module => {
          if (window.currentGameEngine) window.currentGameEngine.stop();
          window.currentGameEngine = new module.GameEngine('game-canvas', selectedChar, this.app.currentAccount.uuid);
        }).catch(err => {
          console.error("Engine Import Error:", err);
          this.app.showModal("Engine Error", "Failed to load engine.js. Open your browser console (F12) to see the exact file path error.");
        });
      });
    }
  }
}
