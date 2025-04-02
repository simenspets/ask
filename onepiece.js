// Funksjon for å prøve å finne elementet med en forsinkelse
function initializeChat() {
  const productFormDiv = document.querySelector('.product-form'); // Ny klasse
  if (!productFormDiv) {
    console.warn("Fant ikke element med klassen .product-form, prøver igjen om 1 sekund...");
    setTimeout(initializeChat, 1000); // Prøv igjen om 1 sekund
    return;
  }

  // Opprett en container for Voiceflow-chatten
  const chatContainer = document.createElement('div');
  chatContainer.id = 'voiceflow-container';

  // Stiler for å integrere chatten mer sømløst i Onepiece-butikken
  chatContainer.style.width = '100%';              // Utnytt hele bredden tilgjengelig
  chatContainer.style.maxWidth = '650px';          // Sett en fornuftig maks-bredde
  chatContainer.style.minHeight = '200px';         // Minimumshøyde på 200px
  chatContainer.style.maxHeight = '600px';         // Maksimumshøyde på 600px
  chatContainer.style.marginTop = '16px';          // Litt mer luft over
  chatContainer.style.overflow = 'auto';           // Scrollbar om innhold overstiger max-height
  chatContainer.style.border = '1px solid #e6e6e6';// Lys, subtil kantlinje
  chatContainer.style.borderRadius = '8px';        // Myke hjørner
  chatContainer.style.boxSizing = 'border-box';    // Inkluderer border i størrelsesberegning
  chatContainer.style.position = 'relative';       // Sørger for korrekt rendering av border
  chatContainer.style.display = 'block';           // Tar opp hele bredden
  chatContainer.style.zIndex = '1';                // Over andre elementer ved behov
  chatContainer.style.backgroundColor = '#fff';    // Hvit bakgrunn
  chatContainer.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'; // Diskré skygge

  // Legg containeren ETTER productFormDiv i DOM-et
  productFormDiv.after(chatContainer);

  // Last inn Voiceflow chat-widget
  (function(d, t) {
    var v = d.createElement(t),
        s = d.getElementsByTagName(t)[0];
    v.onload = function() {
      window.voiceflow.chat.load({
        verify: { projectID: '67ebcf06d342c605de8149bc' }, // <--- Oppdatert projectID
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
      chatContainer.style.height = 'auto'; // Tilpass høyden til innholdet ved endringer
    });
    observer.observe(chatContainer, { childList: true, subtree: true });
  })(document, 'script');
}

// Start initialiseringen
initializeChat();
