// Funksjon for å prøve å finne elementet med en forsinkelse
function initializeChat() {
  const contentFadeDiv = document.querySelector('.contentFade-wrapper-SNk');
  if (!contentFadeDiv) {
    console.warn("Fant ikke element med klassen .contentFade-wrapper-SNk, prøver igjen om 1 sekund...");
    setTimeout(initializeChat, 1000); // Prøv igjen om 1 sekund
    return;
  }

  // Opprett en container for Voiceflow-chatten
  const chatContainer = document.createElement('div');
  chatContainer.id = 'voiceflow-container';

  // Stil containeren
  chatContainer.style.minHeight = '200px'; // Minimumshøyde på 200px
  chatContainer.style.maxHeight = '270px'; // Maksimumshøyde på 300px
  chatContainer.style.width = '634.5px';   // Bredde på 634.5px
  chatContainer.style.maxWidth = '634.5px'; // Maksimumsbredde på 634.5px
  chatContainer.style.marginTop = '8px';   // Litt luft over widgeten
  chatContainer.style.overflow = 'auto';   // Scrollbar vises når innholdet overstiger max-height
  chatContainer.style.border = '2px solid #CCCCCC'; // Kantlinje
  chatContainer.style.borderRadius = '10px';        // Avrundede hjørner
  chatContainer.style.boxSizing = 'border-box';     // Inkluderer border i størrelsesberegning
  chatContainer.style.position = 'relative';        // Sørger for korrekt rendering av border
  chatContainer.style.display = 'block';            // Sørger for at containeren tar opp hele bredden
  chatContainer.style.zIndex = '1';                 // Sørger for at borderen ikke klippes av andre elementer

  // Legg containeren ETTER contentFadeDiv i DOM-et
  contentFadeDiv.after(chatContainer);

  // Last inn Voiceflow chat-widget
  (function(d, t) {
    var v = d.createElement(t),
        s = d.getElementsByTagName(t)[0];
    v.onload = function() {
      window.voiceflow.chat.load({
        verify: { projectID: '67d1ad605c5916e15e7ceb94' },
        url: 'https://general-runtime.voiceflow.com',
        versionID: 'production',
        assistant: {
          stylesheet: "https://kristoman-rikardo.github.io/dafaq/style.css",
        },
        render: {
          mode: 'embedded',
          target: chatContainer,
        },
        launch: {
          event: {
            type: "launch",
            payload: { test_url: window.location.href }
          }
        },
        autostart: true,
      });

      // Tving en oppdatering av høyden etter at widgeten er lastet
      setTimeout(() => {
        chatContainer.style.height = 'auto'; // Lar containeren tilpasse seg innholdet
      }, 1000); // Vent 1 sekund for å sikre at widgeten er ferdig lastet
    };
    v.src = "https://cdn.voiceflow.com/widget-next/bundle.mjs";
    v.type = "text/javascript";
    s.parentNode.insertBefore(v, s);

    // Legg til en MutationObserver for å overvåke endringer i chatContainer
    const observer = new MutationObserver(() => {
      chatContainer.style.height = 'auto'; // Tilpass høyden til innholdet
    });
    observer.observe(chatContainer, { childList: true, subtree: true });
  })(document, 'script');
}

// Start initialiseringen
initializeChat();
