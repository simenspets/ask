(function() {
    // Aktiv instans av widget
    let activeWidget = null;
    // Hold styr på aktive ResizeObservers for cleanup
    let activeMutationObservers = [];
    let activeResizeObservers = [];
    
    // Konfigurasjon - kan endres basert på implementasjon
    const config = {
      apiKey: 'VF.DM.67f3a3aabc8d1cb788d71d55.oO0bhO9dNnsn67Lv',
      projectID: '67f291952280faa3b19ddfcb',
      cssPath: 'https://kristoman-rikardo.github.io/ask1proto-21/dist/widget/chatWidget.css',
      jsPath: 'https://kristoman-rikardo.github.io/ask1proto-21/dist/widget/chatWidget.js',
      scrapePath: 'https://kristoman-rikardo.github.io/ask1proto-21/scrapeSite.js',
      containerID: 'ask-chat-widget-container',
      targetSelectorDesktop: '.product-accordion.accordion-items.product-view__accordion', // Legacy, brukes som fallback
      targetSelectorMobile: '.product-description__short-description', // For skjermer smalere enn 768px
      targetSelectorLargeDesktop: 'section.product-view__main', // For skjermer bredere enn 1024px
      targetSelectorMediumDesktop: 'section.product-view__main', // For skjermer mellom 768px og 1028px
      breakpoint: 768, // Grensepunkt for å bytte mellom mobile og desktop selektorer
      mediumBreakpoint: 1028, // Grensepunkt for mellomstore skjermer (768px-1028px)
      largeBreakpoint: 1024, // Grensepunkt for store skjermer (>=1024px)
      minHeight: 300,
      resizeInterval: 1000, // Økt til 1000ms for bedre ytelse
      voiceflowTimeout: 15000, // Timeout for Voiceflow API i millisekunder
      performanceMode: true,   // Reduserer antall oppdateringer for bedre ytelse
      debug: true,             // Setter til true for feilsøking
      conversionTagLabel: 'conversion' // Tag for konverteringer
    };
    
    // Globale variabler for å holde styr på widgetstatus
    let isWidgetInitialized = false;
    let widgetFullyInitialized = false; // For å holde styr på om widgeten er fullt initialisert
    let canUseShadowDOM = true;
    let lastMeasuredHeight = 0;
    let resizeIntervalId = null;
    let overrideStyleElement = null;
    let activeTimers = []; // For å holde styr på aktive timers for cleanup
    let lastTargetType = null; // 'mobile' eller 'desktop' for å holde styr på nåværende widget-plassering
    let reportTagId = "68062ad1990094c1088b19d7"; // Fast ID for konverteringstaggen
    let hasAddedScrapeListener = false; // Sjekk om vi allerede har lagt til scrapeComplete-lytter
  
    // Deklarerer globale variabler
    let activeWidgetInitialized = false;
    let activeLoadingScreen = null;
    let activeContentContainer = null;
  
    // Legg til en variabel for å spore om bredden er satt
    let containerWidthIsFixed = false;
  
    // Enkel logging kun til konsoll for widget initialisering
    function log(message) {
      // Logg initialiseringsmeldingen til konsollen
      if (message.includes('Widget successfully initialized')) {
        console.log(`[AskWidget] Ask Widget Initialized`);
      }
      // Andre meldinger logges ikke
    }
    
    // Test om Shadow DOM faktisk fungerer i denne konteksten
    function testShadowDOMSupport() {
      try {
        const testDiv = document.createElement('div');
        const shadow = testDiv.attachShadow({ mode: 'open' });
        
        if (shadow && testDiv.shadowRoot) {
          const testParagraph = document.createElement('p');
          testParagraph.textContent = 'Shadow DOM Test';
          shadow.appendChild(testParagraph);
          
          const success = testDiv.shadowRoot.querySelector('p') !== null;
          testDiv.remove();
          return success;
        }
        return false;
      } catch (error) {
        log(`Shadow DOM not supported`);
        return false;
      }
    }
    
    // Legg til globale CSS-overstyringer
    function addGlobalStyles() {
      if (overrideStyleElement) {
        overrideStyleElement.remove();
      }
      
      overrideStyleElement = document.createElement('style');
      overrideStyleElement.id = 'ask-widget-global-overrides';
      
      overrideStyleElement.innerHTML = `
        /* Globale stiler for å sikre at widget-containeren kan ekspandere fritt */
        #${config.containerID}:not(#\\9):not(#\\9):not(#\\9) {
          height: auto !important;
          min-height: ${config.minHeight}px !important;
          max-height: none !important;
          overflow: visible !important;
          position: relative !important;
          display: block !important;
          opacity: 1 !important;
          visibility: visible !important;
          box-sizing: border-box !important;
          resize: none !important;
          margin: 0 !important;
          z-index: 100 !important;
          width: 100% !important;
        }
        
        /* Grid-layout for desktop visning (basert på 64em = 1024px) */
        @media (min-width: 64em) {
          /* Gjør hovedgridet todelt: tekst 1fr + widget 50vw */
          section.product-view__main[data-v-4d2ec0af] {
            grid-template-columns: 1fr 50vw !important;
            gap: 2rem !important;
          }
          
          /* Stil for widget-container */
          #${config.containerID} {
            padding: 0 !important;
            margin: 0 !important;
          }
        }
        
        /* Sikre at Shadow DOM wrapper også kan ekspandere */
        #${config.containerID}:not(#\\9) > div,
        #${config.containerID}:not(#\\9) .chat-widget-shadow-container,
        #${config.containerID}:not(#\\9) .chat-interface,
        #${config.containerID}:not(#\\9) .chat-messages-container,
        #${config.containerID}:not(#\\9) .chat-messages-scroll-container,
        #${config.containerID}:not(#\\9) .messages-list,
        #${config.containerID}:not(#\\9) .message-item {
          height: auto !important;
          max-height: none !important;
          overflow: visible !important;
          visibility: visible !important;
          display: block !important;
        }
        
        /* Spesifikk stil for å sikre at shadow-container er synlig */
        #chat-widget-shadow-container {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
  
        /* Fjern høyde fra notifications-region */
        div[role="region"][aria-label="Notifications (F8)"] {
          height: 0 !important;
          min-height: 0 !important;
          max-height: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
          overflow: hidden !important;
          visibility: hidden !important;
          opacity: 0 !important;
        }
        
        @media (min-width: 768px) {
          section.product-view__main {
            display: grid !important;
            grid-template-columns: 1fr 525px !important;
            gap: 2rem !important;
            position: relative;
          }
          #${config.containerID} {
            grid-column: 2;
            align-self: start;
            width: 100% !important;
            max-width: 525px !important;
            margin-left: auto;
            margin-right: 0;
          }
        }
      `;
      
      document.head.appendChild(overrideStyleElement);
      log('Added global CSS overrides');
    }
    
    // Hjelpefunksjon: Setter widget-containerens max-width basert på foreldreelementet, men kun én gang
    function updateContainerMaxWidth() {
      try {
        if (!activeWidget || !activeWidget.shadowRoot || containerWidthIsFixed) return;
        
        const container = activeWidget.shadowRoot.querySelector('.chat-container');
        if (!container) return;
        
        const windowWidth = window.innerWidth;
        const isMobileView = windowWidth < 768;
        
        // Finn foreldre-element og dets størrelse
        const parent = activeWidget.parentElement;
        if (!parent) return;
        
        const parentWidth = parent.offsetWidth;
        const parentMaxWidth = parseInt(window.getComputedStyle(parent).maxWidth, 10) || Infinity;
        
        let containerMaxWidth;
        
        // Håndter mobile visning spesielt
        if (isMobileView) {
          containerMaxWidth = Math.min(windowWidth - 40, parentWidth) + 'px';
        } else {
          // Fallback til window-bredde minus en margin hvis foreldrebredde ikke er tilgjengelig
          const availableWidth = parentWidth || (windowWidth - 100);
          
          // Begrens bredden til maks 1200px for bedre lesbarhet på brede skjermer
          const maxRecommendedWidth = 1200;
          
          // Bruk foreldrebredde, men begrens til maksimalbredden hvis definert
          containerMaxWidth = parentMaxWidth !== Infinity 
            ? Math.min(availableWidth, parentMaxWidth, maxRecommendedWidth) + 'px'
            : Math.min(availableWidth, maxRecommendedWidth) + 'px';
        }
        
        // Sett widgetens bredde én gang og marker som låst
        container.style.maxWidth = containerMaxWidth;
        
        // Oppdater også bredden for karuselvisningen hvis den finnes
        const carousel = activeWidget.shadowRoot.querySelector('.carousel-view');
        if (carousel) {
          carousel.style.maxWidth = containerMaxWidth;
        }
        
        // Merk at bredden nå er låst og ikke skal endres
        containerWidthIsFixed = true;
      } catch (error) {
        // Stille feilhåndtering i produksjon
      }
    }
    
    // Funksjon for å håndtere widgetminimering/lukking
    function handleWidgetMinimize() {
      log('Widget minimized/closed - resetting container height to minimum');
      setContainerHeight(config.minHeight);
    }
  
    // Hjelpefunksjon for å bestemme riktig målselektor basert på skjermbredde
    function getTargetSelector() {
      const screenWidth = window.innerWidth;
      let targetType = '';
      let selector = '';
      
      if (screenWidth >= config.largeBreakpoint) {
        // Fra og med 1024px - bruk Large Desktop selektor (over similar-products)
        targetType = 'large-desktop';
        selector = config.targetSelectorLargeDesktop;
      } else if (screenWidth >= config.breakpoint && screenWidth < config.mediumBreakpoint) {
        // Mellom 768px og 1028px - bruk Medium Desktop selektor (over første accordion-item__btn)
        targetType = 'medium-desktop';
        selector = config.targetSelectorMediumDesktop;
      } else if (screenWidth < config.breakpoint) {
        // Under 768px - bruk Mobile selektor
        targetType = 'mobile';
        selector = config.targetSelectorMobile;
      } else {
        // Fallback til standard desktop
        targetType = 'desktop';
        selector = config.targetSelectorDesktop;
      }
      
      if (targetType !== lastTargetType) {
        log(`Skjermstørrelse endret til ${targetType} (${screenWidth}px)`);
        lastTargetType = targetType;
      }
      
      return selector;
    }
    
    // Sjekk om produkttittel er tilgjengelig på siden
    function isProductTitleAvailable() {
      const productTitle = document.querySelector('.product-header__title');
      if (productTitle) {
        log('Fant produkttittel: ' + productTitle.textContent.trim());
        return true;
      }
      log('Produkttittel ikke funnet på siden - widget vil ikke bli initialisert');
      return false;
    }
    
    // Finn target-elementet og sett inn widget-containeren
    function setupContainer() {
      log('Setting up widget container');
      
      // Sjekk om produkttittelen er tilgjengelig, hvis ikke avslutt initialiseringen
      if (!isProductTitleAvailable()) {
        log('Produkttittel ikke funnet - widget blir ikke initialisert');
        return false;
      }
      
      addGlobalStyles();
      
      const activeSelector = getTargetSelector();
      log(`Bruker selektor: ${activeSelector} for nåværende skjermstørrelse (${window.innerWidth}px)`);
      
      // Fjern eksisterende container dersom den finnes
      const existingContainer = document.getElementById(config.containerID);
      if (existingContainer) {
        existingContainer.remove();
        log('Removed existing widget container');
      }
      
      // Opprett ny container for chat-widgeten
      const container = document.createElement('div');
      container.id = config.containerID;
      container.setAttribute('data-ask-widget', 'true');
      container.setAttribute('data-expandable', 'true');
      
      const screenWidth = window.innerWidth;
      
      if (screenWidth >= config.largeBreakpoint) {
        // For stor desktop (>= 1024px): Plasser INNE i section.product-view__main, rett over Similar styles hvis den finnes
        const mainSection = document.querySelector(config.targetSelectorLargeDesktop);
        const similarSection = mainSection ? mainSection.querySelector('section.similar-product-list.product-view__similar-products') : null;
        if (mainSection && similarSection) {
          mainSection.insertBefore(container, similarSection);
          log('Widget plassert over Similar styles (large desktop)');
        } else if (mainSection) {
          mainSection.appendChild(container);
          log('Widget plassert helt til høyre i section.product-view__main (large desktop)');
        } else {
          document.body.appendChild(container);
          log('Using document.body as fallback container (large desktop)');
        }
      } else if (screenWidth >= config.breakpoint && screenWidth < config.mediumBreakpoint) {
        // For medium desktop (768px - 1028px): Plasser INNE i section.product-view__main, rett over Similar styles hvis den finnes
        const mainSection = document.querySelector(config.targetSelectorMediumDesktop);
        const similarSection = mainSection ? mainSection.querySelector('section.similar-product-list.product-view__similar-products') : null;
        if (mainSection && similarSection) {
          mainSection.insertBefore(container, similarSection);
          log('Widget plassert over Similar styles (medium desktop)');
        } else if (mainSection) {
          mainSection.appendChild(container);
          log('Widget plassert helt til høyre i section.product-view__main (medium desktop)');
        } else {
          document.body.appendChild(container);
          log('Using document.body as fallback container (medium desktop)');
        }
      } else {
        // For mobil (< 768px): bruk standard mobilplassering
        const targetElement = document.querySelector(config.targetSelectorMobile);
        
        if (targetElement) {
          targetElement.appendChild(container);
          log('Widget plassert på standard mobilposisjon');
        } else {
          document.body.appendChild(container);
          log('Using document.body as fallback container');
        }
      }
      
      log('Added chat widget container to target element');
      setContainerHeight(config.minHeight);
      
      // Start monitorering av containerhøyde
      setupHeightMonitoring();
      
      return true;
    }
  
    // Håndter vindusendringer - flytt widget ved behov
    function handleWindowResize() {
      const container = document.getElementById(config.containerID);
      const screenWidth = window.innerWidth;
      
      // Vi beholder flytt-logikken hvis widget-containeren ikke er hvor den skal være
      if (container && isWidgetInitialized) {
        if (screenWidth >= config.largeBreakpoint) {
          const mainSection = document.querySelector(config.targetSelectorLargeDesktop);
          if (mainSection && container.parentNode !== mainSection) {
            mainSection.appendChild(container);
            log('Flytter widget til høyre i section.product-view__main (large)');
          }
        } else if (screenWidth >= config.breakpoint && screenWidth < config.mediumBreakpoint) {
          const mainSection = document.querySelector(config.targetSelectorMediumDesktop);
          if (mainSection && container.parentNode !== mainSection) {
            mainSection.appendChild(container);
            log('Flytter widget til høyre i section.product-view__main (medium)');
          }
        } else if (screenWidth < config.breakpoint) {
          // For mobil (< 768px): container skal være INNE i målelementet
          const mobileTarget = document.querySelector(config.targetSelectorMobile);
          
          if (mobileTarget && !mobileTarget.contains(container)) {
            log(`Flytter widget til mobilposisjon INNE i målelement (${config.targetSelectorMobile})`);
            mobileTarget.appendChild(container);
            log('Widget flyttet til mobilposisjon');
          }
        }
      }
    }
    
    // Last inn nødvendige stilark
    function loadStyles() {
      log('Loading widget styles');
      return new Promise((resolve) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = config.cssPath;
        
        link.onload = () => {
          log('Widget stylesheet loaded');
          resolve();
        };
        
        link.onerror = () => {
          log('Failed to load widget stylesheet');
          resolve();
        };
        
        document.head.appendChild(link);
      });
    }
    
    // Funksjon for å måle faktisk høyde av widget
    function measureWidgetHeight() {
      const container = document.getElementById(config.containerID);
      if (!container) return 0;
      let measuredHeight = 0;
      
      if (canUseShadowDOM && container.shadowRoot) {
        try {
          const shadowContainer = container.shadowRoot.getElementById('chat-widget-shadow-container');
          if (shadowContainer) {
            measuredHeight = Math.max(measuredHeight, shadowContainer.scrollHeight);
            measuredHeight = Math.max(measuredHeight, container.shadowRoot.host.scrollHeight);
          }
          const selectors = [
            '#chat-widget-shadow-container',
            '.chat-interface',
            '.chat-messages-container',
            '.chat-messages-scroll-container',
            '.messages-list'
          ];
          selectors.forEach(selector => {
            const elements = container.shadowRoot.querySelectorAll(selector);
            elements.forEach(el => {
              if (el) {
                measuredHeight = Math.max(
                  measuredHeight, 
                  el.scrollHeight || 0, 
                  el.offsetHeight || 0, 
                  el.clientHeight || 0
                );
              }
            });
          });
        } catch (e) {
          log(`Error measuring Shadow DOM height: ${e.message}`);
        }
      }
      
      if (measuredHeight <= 0) {
        try {
          measuredHeight = Math.max(
            measuredHeight, 
            container.scrollHeight || 0,
            container.offsetHeight || 0,
            container.clientHeight || 0
          );
          
          const calculateMaxChildHeight = (element) => {
            if (!element) return 0;
            let height = element.offsetHeight || element.scrollHeight || element.clientHeight || 0;
            Array.from(element.children || []).forEach(child => {
              const childHeight = calculateMaxChildHeight(child);
              height = Math.max(height, childHeight);
            });
            return height;
          };
          
          const childrenHeight = calculateMaxChildHeight(container);
          measuredHeight = Math.max(measuredHeight, childrenHeight);
        } catch (e) {
          log(`Error measuring DOM height: ${e.message}`);
        }
      }
      
      const finalHeight = Math.max(measuredHeight, config.minHeight);
      if (Math.abs(finalHeight - lastMeasuredHeight) > 10) {
        lastMeasuredHeight = finalHeight;
        log(`Measured new height: ${finalHeight}px`);
      }
      
      return finalHeight;
    }
    
    // Funksjon for å sette container høyde
    function setContainerHeight(height) {
      const container = document.getElementById(config.containerID);
      if (!container) return;
      
      const currentStyle = container.getAttribute('style') || '';
      const updatedStyle = currentStyle
        .replace(/min-height:[^;]+;/g, '')
        .replace(/height:[^;]+;/g, '')
        .replace(/max-height:[^;]+;/g, '') +
        `min-height: ${height}px !important; height: auto !important; max-height: none !important;`;
      
      container.setAttribute('style', updatedStyle);
      container.style.minHeight = `${height}px !important`;
      container.style.height = 'auto !important';
      container.style.maxHeight = 'none !important';
      container.setAttribute('data-height', height.toString());
      
      if (!canUseShadowDOM) {
        removeHeightRestrictions(container);
      }
      
      if (canUseShadowDOM && container.shadowRoot) {
        try {
          const shadowContainer = container.shadowRoot.getElementById('chat-widget-shadow-container');
          if (shadowContainer) {
            shadowContainer.style.minHeight = `${height}px`;
            shadowContainer.style.height = 'auto';
            shadowContainer.style.maxHeight = 'none';
            shadowContainer.style.overflow = 'visible';
          }
          removeHeightRestrictions(container.shadowRoot);
        } catch (e) {
          log(`Error modifying Shadow DOM styles: ${e.message}`);
        }
      }
    }
    
    // Fjern alle høydebegrensninger fra en DOM-struktur
    function removeHeightRestrictions(rootElement) {
      if (!rootElement) return;
      const elementsToFix = rootElement.querySelectorAll(
        '.chat-interface, .chat-messages-container, .messages-list, .message-item, .chat-messages-scroll-container'
      );
      
      elementsToFix.forEach(el => {
        if (el) {
          el.style.height = 'auto !important';
          el.style.maxHeight = 'none !important';
          el.style.overflow = 'visible !important';
          el.setAttribute('style', (el.getAttribute('style') || '') + 
            'height: auto !important; max-height: none !important; overflow: visible !important;');
        }
      });
    }
    
    // Vis widgeten - optimalisert for ytelse
    function showWidget() {
      log('Showing widget');
      const container = document.getElementById(config.containerID);
      if (!container) {
        log('ERROR: Container not found when trying to show widget');
        return;
      }
      
      container.style.display = 'block';
      container.style.visibility = 'visible';
      container.style.opacity = '1';
      container.style.height = 'auto';
      
      const initialHeight = measureWidgetHeight() || config.minHeight;
      setContainerHeight(initialHeight);
      
      container.setAttribute('data-visible', 'true');
      
      // Vi oppdaterer kun høyden, ikke bredden som nå er låst
      createTimeout(() => {
        const newHeight = measureWidgetHeight();
        if (newHeight > initialHeight) {
          setContainerHeight(newHeight);
        }
      }, 300);
    }
    
    // Kontinuerlig høydejustering - optimalisert for ytelse
    function setupHeightMonitoring() {
      const container = document.getElementById(config.containerID);
      if (!container) return;
      
      log('Setting up height monitoring (optimized)');
      addGlobalStyles();
      checkAndUpdateHeight();
      
      if (resizeIntervalId) {
        clearInterval(resizeIntervalId);
      }
      
      const intervalTime = config.performanceMode ? config.resizeInterval * 2 : config.resizeInterval;
      
      resizeIntervalId = setInterval(() => {
        checkAndUpdateHeight();
        if (!document.getElementById('ask-widget-global-overrides') && Math.random() < 0.2) {
          addGlobalStyles();
        }
      }, intervalTime);
      
      const intervals = config.performanceMode 
        ? [500, 2000, 5000] 
        : [100, 300, 600, 1000, 2000, 3000, 5000];
      
      intervals.forEach(delay => {
        createTimeout(checkAndUpdateHeight, delay);
      });
      
      // Oppdatert MutationObserver: lytter nå også på data-visible for endringer (f.eks. ved minimering)
      if (window.MutationObserver) {
        try {
          const observer = new MutationObserver((mutations) => {
            if (observer._debounceTimer) {
              clearTimeout(observer._debounceTimer);
            }
            observer._debounceTimer = setTimeout(() => {
              checkAndUpdateHeight();
            }, 100);
          });
          
          observer.observe(container, { 
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class', 'data-visible'],
            characterData: false
          });
          activeMutationObservers.push(observer);
          
          if (canUseShadowDOM && container.shadowRoot && !config.performanceMode) {
            try {
              const shadowObserver = new MutationObserver(() => {
                if (shadowObserver._debounceTimer) {
                  clearTimeout(shadowObserver._debounceTimer);
                }
                shadowObserver._debounceTimer = setTimeout(() => {
                  checkAndUpdateHeight();
                }, 100);
              });
              
              shadowObserver.observe(container.shadowRoot, { 
                childList: true, 
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class'],
                characterData: false
              });
              
              activeMutationObservers.push(shadowObserver);
              log('Monitoring Shadow DOM for changes (optimized)');
            } catch (e) {
              log(`Could not observe Shadow DOM: ${e.message}`);
            }
          }
        } catch (e) {
          log(`Error setting up MutationObserver: ${e.message}`);
        }
      }
      
      window.addEventListener('resize', () => {
        checkAndUpdateHeight();
        handleWindowResize();
      });
      
      if (!config.performanceMode) {
        document.addEventListener('click', function() {
          createTimeout(checkAndUpdateHeight, 100);
        });
      }
    }
    
    // Mer effektiv sjekk og oppdatering av høyde
    function checkAndUpdateHeight() {
      if (checkAndUpdateHeight._lastRun && 
          Date.now() - checkAndUpdateHeight._lastRun < 100) {
        return;
      }
      
      checkAndUpdateHeight._lastRun = Date.now();
      
      const height = measureWidgetHeight();
      if (height > 0) {
        if (Math.abs(height - lastMeasuredHeight) < 5) {
          return;
        }
        
        lastMeasuredHeight = height;
        setContainerHeight(height);
      }
    }
    
    // Håndter scrapeComplete-hendelsen
    function handleScrapeComplete(event) {
      if (isWidgetInitialized) {
        log('Widget already initialized, ignoring duplicate scrapeComplete event');
        return;
      }
      
      log('Received scrapeComplete event');
      const { side_innhold, browser_url, produkt_navn } = event.detail || {};
       
      // Logg bruker-ID info (alltid, uavhengig av debug-flagg)
      if (produkt_navn) {
        console.log(`Produktnavn for bruker-ID: "${produkt_navn}"`);
      } else {
        console.log('Ingen produktnavn tilgjengelig for bruker-ID');
      }
      
      if (!side_innhold || side_innhold.length === 0) {
        log('No content extracted from page');
        return;
      }
      
      // Forsikre oss om at ChatWidget er lastet før vi initialiserer
      if (window.ChatWidget && typeof window.ChatWidget.init === 'function') {
        log('Initializing ChatWidget with options');
        
        try {
          const originalFetch = window.fetch;
          if (!window.fetch._patched) {
            window.fetch = function(url, options) {
              const isVoiceflowRequest = typeof url === 'string' && (
                url.includes('voiceflow.com') || 
                url.includes('vfre') || 
                url.includes('vf.to')
              );
              
              if (isVoiceflowRequest) {
                log('Detected Voiceflow API request, adding timeout');
                const controller = new AbortController();
                const timeoutId = setTimeout(() => {
                  controller.abort();
                  log('Voiceflow request timed out after ' + config.voiceflowTimeout + 'ms');
                }, config.voiceflowTimeout);
                
                const fetchOptions = options || {};
                fetchOptions.signal = controller.signal;
                
                return originalFetch(url, fetchOptions)
                  .then(response => {
                    clearTimeout(timeoutId);
                    return response;
                  })
                  .catch(error => {
                    clearTimeout(timeoutId);
                    log('Voiceflow request error: ' + error.message);
                    throw error;
                  });
              }
              return originalFetch(url, options);
            };
            window.fetch._patched = true;
          }
          
          // Initialiser widgeten med konfigurasjonen
          window.ChatWidget.init({
            containerId: config.containerID,
            apiKey: config.apiKey,
            projectID: config.projectID,
            apiEndpoint: 'https://general-runtime.voiceflow.com',
            disableAutoScroll: true,
            launchConfig: {
              event: {
                type: "launch",
                payload: {
                  browser_url: browser_url || window.location.href,
                  side_innhold: side_innhold.substring(0, 5000),
                  produkt_navn: produkt_navn || ''
                }
              }
            }
          });
          
          log(`Widget successfully initialized (${canUseShadowDOM ? 'with' : 'without'} Shadow DOM)`);
          // Merk at widgeten er initialisert
          isWidgetInitialized = true;
          
          let voiceflowStatusCheckCount = 0;
          const maxStatusChecks = 10;
          
          const checkVoiceflowStatus = () => {
            voiceflowStatusCheckCount++;
            
            const widgetInitializedProperly = (
              window.ChatWidget && 
              window.ChatWidget.isInitialized && 
              document.getElementById(config.containerID)
            );
            
            if (widgetInitializedProperly) {
              log('ChatWidget fully initialized');
              widgetFullyInitialized = true;
              
              createTimeout(() => {
                addGlobalStyles();
                showWidget();
                setupHeightMonitoring();
                
                // Kun oppdater høyden, ikke bredden
                createTimeout(checkAndUpdateHeight, 1000);
                createTimeout(checkAndUpdateHeight, 2000);
              }, 300);
            } else if (voiceflowStatusCheckCount < maxStatusChecks) {
              const delay = 500 * Math.pow(1.5, voiceflowStatusCheckCount - 1);
              createTimeout(checkVoiceflowStatus, delay);
            } else {
              log('WARNING: ChatWidget initialization status could not be confirmed');
              widgetFullyInitialized = false;
              createTimeout(() => {
                addGlobalStyles();
                showWidget();
                setupHeightMonitoring();
              }, 500);
            }
          };
          
          createTimeout(checkVoiceflowStatus, 500);
        } catch (error) {
          log(`Error initializing widget: ${error.message}`);
          
          // Hvis vi bruker Shadow DOM og det feiler, prøv igjen uten
          if (canUseShadowDOM) {
            log('Retrying widget initialization without Shadow DOM');
            canUseShadowDOM = false;
            isWidgetInitialized = false;
            handleScrapeComplete(event);
          }
        }
      } else {
        log('Failed to initialize widget: window.ChatWidget.init is not a function');
        
        // Legg til en sjekk som prøver å finne faktisk type av window.ChatWidget
        if (window.ChatWidget) {
          log(`window.ChatWidget er av typen: ${typeof window.ChatWidget}`);
          if (typeof window.ChatWidget === 'object') {
            const keys = Object.keys(window.ChatWidget);
            log(`window.ChatWidget har følgende egenskaper: ${keys.join(', ')}`);
            
            // Hvis det ser ut som window.ChatWidget er et objekt med default-egenskap som har init
            if (window.ChatWidget.default && typeof window.ChatWidget.default.init === 'function') {
              log('Trying to use window.ChatWidget.default.init instead');
              try {
                window.ChatWidget.default.init({
                  containerId: config.containerID,
                  apiKey: config.apiKey,
                  projectID: config.projectID,
                  apiEndpoint: 'https://general-runtime.voiceflow.com',
                  disableAutoScroll: true,
                  launchConfig: {
                    event: {
                      type: "launch",
                      payload: {
                        browser_url: browser_url || window.location.href,
                        side_innhold: side_innhold.substring(0, 5000),
                        produkt_navn: produkt_navn || ''
                      }
                    }
                  }
                });
                
                isWidgetInitialized = true;
                log(`Widget successfully initialized using default export (${canUseShadowDOM ? 'with' : 'without'} Shadow DOM)`);
                
                setTimeout(() => {
                  showWidget();
                  setupHeightMonitoring();
                }, 100);
                
                return; // Vi har lykkes, avslutt funksjonen
              } catch (error) {
                log(`Error initializing with default export: ${error.message}`);
              }
            }
          }
        }
        
        // Hvis vi bruker Shadow DOM og det feiler, prøv igjen uten
        if (canUseShadowDOM) {
          log('Retrying widget initialization without Shadow DOM');
          canUseShadowDOM = false;
          isWidgetInitialized = false;
          handleScrapeComplete(event);
        } else {
          isWidgetInitialized = false;
          log('Could not initialize ChatWidget after retry, giving up');
        }
      }
    }
    
    // Last inn chat widget-kjernen
    function loadWidgetScript() {
      log('Loading widget script');
      return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = config.jsPath;
        
        script.onload = () => {
          log('Widget script loaded successfully');
          resolve(true);
        };
        
        script.onerror = () => {
          log('Failed to load widget script');
          resolve(false);
        };
        
        document.body.appendChild(script);
      });
    }
    
    // Last inn skrapeskriptet
    function loadScrapeScript() {
      log('Loading scrape script');
      return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = config.scrapePath;
        
        script.onload = () => {
          log('Scrape script loaded successfully');
          resolve(true);
        };
        
        script.onerror = () => {
          log('Failed to load scrape script');
          resolve(false);
        };
        
        document.body.appendChild(script);
      });
    }
  
    // Hjelpefunksjon for å opprette forsinkelser
    function createTimeout(callback, delay) {
      const timerId = setTimeout(() => {
        callback();
        const index = activeTimers.indexOf(timerId);
        if (index > -1) {
          activeTimers.splice(index, 1);
        }
      }, delay);
      activeTimers.push(timerId);
      return timerId;
    }
    
    // Opprydd i ressurser
    function cleanupResources() {
      activeTimers.forEach(timerId => {
        clearTimeout(timerId);
      });
      activeTimers = [];
      
      if (resizeIntervalId) {
        clearInterval(resizeIntervalId);
        resizeIntervalId = null;
      }
      
      activeMutationObservers.forEach(observer => {
        observer.disconnect();
      });
      activeMutationObservers = [];
      
      if (overrideStyleElement && overrideStyleElement.parentNode) {
        overrideStyleElement.parentNode.removeChild(overrideStyleElement);
      }
      
      log('Cleaned up all resources');
    }
    
    // Registrer for cleanup ved side-navigering
    function setupCleanup() {
      window.addEventListener('beforeunload', cleanupResources);
      window.addEventListener('unload', cleanupResources);
    }
    
    // Registrer lyttere for widget-minimering og lukking
    function setupWidgetCloseListeners() {
      document.addEventListener('widgetMinimized', handleWidgetMinimize);
      document.addEventListener('widgetClosed', handleWidgetMinimize);
    }
    
    // Funksjon for å sjekke om "conversion"-tag eksisterer og opprette den hvis den ikke finnes
    async function ensureProjectTag() {
      if (!config.apiKey || !config.projectID) {
        log('Mangler API-nøkkel eller prosjekt-ID for tag-håndtering');
        return null;
      }
      
      try {
        // 1. Hent gjeldende tag-liste
        const base = `https://api.voiceflow.com/v2/projects/${config.projectID}/tags`;
        const listRes = await fetch(base, {
          headers: { Authorization: config.apiKey }
        });
        
        if (!listRes.ok) {
          log(`Feil ved henting av tags: ${listRes.status}`);
          return null;
        }
        
        const tagsResponse = await listRes.json();
        
        // Sjekk om tagsResponse er en array
        if (!Array.isArray(tagsResponse)) {
          log(`Uventet respons-format fra API: tags er ikke en array: ${typeof tagsResponse}`);
          // Forsøk å håndtere tilfeller der tags kan være i en annen struktur
          const tags = Array.isArray(tagsResponse.tags) ? tagsResponse.tags : [];
          log(`Prøver å bruke alternativ tagsstruktur, fant ${tags.length} tags`);
          let tag = tags.find(t => t.label === config.conversionTagLabel);
          
          if (!tag) {
            return await createTag(base);
          }
          
          log(`Tag "${config.conversionTagLabel}" eksisterer allerede med ID: ${tag._id}`);
          return tag._id;
        }
        
        let tag = tagsResponse.find(t => t.label === config.conversionTagLabel);
  
        // 2. Opprett tag hvis den ikke finnes
        if (!tag) {
          return await createTag(base);
        } else {
          log(`Tag "${config.conversionTagLabel}" eksisterer allerede med ID: ${tag._id}`);
          return tag._id;
        }
      } catch (error) {
        log(`Feil ved håndtering av prosjekt-tag: ${error.message}`);
        return null;
      }
    }
    
    // Hjelpefunksjon for å opprette tag
    async function createTag(base) {
      log(`Oppretter "${config.conversionTagLabel}" tag for prosjektet...`);
      
      try {
        const createRes = await fetch(base, {
          method: 'PUT',
          headers: {
            Authorization: config.apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ label: config.conversionTagLabel })
        });
        
        if (!createRes.ok) {
          log(`Feil ved opprettelse av tag: ${createRes.status}`);
          return null;
        }
        
        const tag = await createRes.json();
        log(`Tag "${config.conversionTagLabel}" opprettet med ID: ${tag._id}`);
        return tag._id;
      } catch (error) {
        log(`Feil ved opprettelse av tag: ${error.message}`);
        return null;
      }
    }
  
    // Funksjon for å tagge et transcript med "conversion"-tag
    async function tagTranscript(transcriptId) {
      if (!reportTagId || !transcriptId) {
        log('Mangler transcriptID eller reportTagID for tagging');
        return false;
      }
      
      try {
        const url = `https://api.voiceflow.com/v2/transcripts/${config.projectID}/${transcriptId}/report_tag/${reportTagId}`;
        const response = await fetch(url, {
          method: 'PUT',
          headers: { Authorization: config.apiKey }
        });
        
        if (response.ok) {
          log(`Transcript ${transcriptId} er tagget med "${config.conversionTagLabel}"`);
          return true;
        } else {
          log(`Feil ved tagging av transcript: ${response.status}`);
          return false;
        }
      } catch (error) {
        log(`Feil ved tagging av transcript: ${error.message}`);
        return false;
      }
    }
  
    // Funksjon for å håndtere klikk på handlekurvknappen
    function handleAddToCartClick(event) {
      // Logg hver hendelse for feilsøking
      log(`Click detected on element: ${event.target.tagName}, class: ${event.target.className}`);
      
      // Bruk flere potensielle knappselektorer
      const addToCartSelectors = [
        '.actions__add-to-cart',
        '.add-to-cart',
        '.single_add_to_cart_button',
        'button[name="add"]',
        '[data-action="add-to-cart"]',
        'button.cart-button',
        'input[value="Add to cart"]',
        'button:contains("Add to Cart")',
        'button:contains("Legg i handlekurv")',
        '.woocommerce-loop-add-to-cart-link'
      ];
      
      // Sjekk om klikket traff en av handlekurvknappene
      let isAddToCartButton = false;
      let matchedSelector = '';
      
      for (const selector of addToCartSelectors) {
        try {
          if (selector.includes(':contains(')) {
            // Spesialhåndtering for innholdsbaserte selektorer
            const textToMatch = selector.match(/:contains\("(.+?)"\)/)[1];
            if (event.target.textContent && event.target.textContent.includes(textToMatch)) {
              isAddToCartButton = true;
              matchedSelector = selector;
              break;
            }
          } else if (event.target.closest(selector)) {
            isAddToCartButton = true;
            matchedSelector = selector;
            break;
          }
        } catch (err) {
          log(`Feil ved sjekk av selektor ${selector}: ${err.message}`);
        }
      }
      
      // Spesifikk sjekk for "buy-button" containere
      if (!isAddToCartButton && 
          (event.target.classList.contains('buy-button') || 
           event.target.closest('.buy-button') ||
           event.target.closest('.actions__add-to-cart'))) {
        isAddToCartButton = true;
        matchedSelector = '.buy-button eller .actions__add-to-cart';
      }
      
      if (!isAddToCartButton) return;
      
      log(`Handlekurvknapp klikket (matcher: ${matchedSelector})`);
      
      try {
        // Prøv først å hente transcript-ID fra sessionStorage
        let transcriptId = sessionStorage.getItem('vf_transcript_id');
        
        // Hvis ikke funnet, prøv å finne det fra dokumentet
        if (!transcriptId) {
          // Sjekk om ID er lagret i et dataelement
          transcriptId = document.querySelector('[data-transcript-id]')?.getAttribute('data-transcript-id');
          
          // Sjekk om window._vfTranscriptId er definert (ofte satt av chatwidget)
          if (!transcriptId && window._vfTranscriptId) {
            transcriptId = window._vfTranscriptId;
          }
          
          // Sjekk lokalt lager
          if (!transcriptId && localStorage.getItem('vf_transcript_id')) {
            transcriptId = localStorage.getItem('vf_transcript_id');
          }
        }
        
        if (!transcriptId) {
          log('TranscriptID mangler – tagger ikke konvertering.');
          return;
        }
  
        log(`Forsøker å tagge transcript: ${transcriptId}`);
        tagTranscript(transcriptId)
          .then(success => {
            if (success) {
              log('Konvertering registrert: handlekurv-klikk');
            } else {
              log('Kunne ikke tagge konvertering: Server returnerte feil');
            }
          })
          .catch(err => {
            log(`Kunne ikke tagge konvertering: ${err.message}`);
          });
      } catch (err) {
        log(`Feil ved tagging av konvertering: ${err.message}`);
      }
    }
  
    // Funksjon for å sette opp lytter for handlekurvklikk
    function setupConversionListener() {
      log('Setter opp lytter for handlekurvklikk');
      
      // Fjern eksisterende lytter først for å unngå duplikater
      document.removeEventListener('click', handleAddToCartClick, true);
      document.addEventListener('click', handleAddToCartClick, true);
      
      // Legg til i aktive lyttere for cleanup
      const cleanup = () => {
        document.removeEventListener('click', handleAddToCartClick, true);
      };
      
      if (typeof window.__widgetCleanupHandlers === 'undefined') {
        window.__widgetCleanupHandlers = [];
      }
      
      window.__widgetCleanupHandlers.push(cleanup);
    }
  
    // Funksjon for å initialisere konverteringssporing
    async function initConversionTracking() {
      try {
        log('Initialiserer konverteringssporing');
        // Her bruker vi den faste tag-ID-en i stedet for å kalle ensureProjectTag
        
        if (reportTagId) {
          log(`Konverteringssporing initialisert med fast tag-ID: ${reportTagId}`);
          setupConversionListener();
        } else {
          log('Kunne ikke initialisere konverteringssporing pga. manglende tag-ID');
        }
      } catch (err) {
        log(`Feil ved initialisering av konverteringssporing: ${err.message}`);
      }
    }
  
    // Hovedfunksjon for å initialisere alt - optimalisert for ytelse
    async function initialize() {
      log('Ask widget initialization started');
      
      // Sjekk om produkttittelen finnes før vi fortsetter med initialiseringen
      if (!isProductTitleAvailable()) {
        log('Produkttittel ikke funnet - avbryter initialisering');
        return;
      }
      
      setupCleanup();
      setupWidgetCloseListeners(); // Registrer nye lyttere for lukking/minimering
      
      canUseShadowDOM = testShadowDOMSupport();
      log(`Shadow DOM support: ${canUseShadowDOM ? 'Detected' : 'Not available'}`);
      
      addGlobalStyles();
      
      // Registrer resize-lytter for å håndtere endringer i skjermstørrelse
      window.addEventListener('resize', () => {
        handleWindowResize();
      });
      
      if (!setupContainer()) {
        log('Failed to set up container, aborting initialization');
        return;
      }
      
      await loadStyles();
      
      // Unngå doble lyttere for scrapeComplete
      if (!hasAddedScrapeListener) {
        window.addEventListener('scrapeComplete', handleScrapeComplete);
        hasAddedScrapeListener = true;
        log('Added scrapeComplete event listener');
      }
      
      const widgetLoaded = await loadWidgetScript();
      if (!widgetLoaded) {
        log('Widget script failed to load, aborting initialization');
        return;
      }
      
      // Initialiser konverteringssporing ETTER at widget er lastet
      initConversionTracking().catch(err => {
        log(`Feil ved initialisering av konverteringssporing: ${err.message}`);
      });
      
      loadScrapeScript().then(scrapeLoaded => {
        if (!scrapeLoaded) {
          log('Scrape script failed to load, will try manual fallback');
        }
      });
      
      log('Initialization complete, waiting for content to be scraped');
      
      createTimeout(() => {
        if (!isWidgetInitialized) {
          log('No scrapeComplete event received, trying to initialize manually');
          let content = '';
          const targetElement = document.querySelector(getTargetSelector());
          if (targetElement) {
            content = targetElement.innerText || targetElement.textContent || '';
          }
          
          if (!content || content.length < 100) {
            const possibleSources = [
              document.querySelector('main'),
              document.querySelector('.product-description'),
              document.querySelector('.product-details'),
              document.querySelector('article'),
              document.body
            ];
            
            for (const source of possibleSources) {
              if (source) {
                const sourceContent = source.innerText || source.textContent || '';
                if (sourceContent.length > content.length) {
                  content = sourceContent;
                }
              }
            }
          }
          
          if (content && content.length > 0) {
            log('Dispatching manual scrapeComplete event');
            window.dispatchEvent(new CustomEvent('scrapeComplete', {
              detail: {
                side_innhold: content.substring(0, 10000),
                browser_url: window.location.href
              }
            }));
          }
        }
      }, 5000);
      
      // Legg til en melding om at widgeten er initialisert for å triggre loggingen
      log('Widget successfully initialized');
    }
    
    function monitorLoadState() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
      } else {
        initialize();
      }
      
      window.addEventListener('load', () => {
        if (!isWidgetInitialized) {
          initialize();
        }
      });
    }
    
    monitorLoadState();
  
    // Legg til en lytter for orientering-endringer
    window.addEventListener('orientationchange', function() {
      // Vent litt før oppdatering ved orientering-endringer for å gi nettleseren tid til å fullføre endringen
      setTimeout(checkAndUpdateHeight, 300); // Kun oppdater høyden, ikke bredden
    });
  
    // Forbedret ResizeObserver implementasjon
    function setupResizeObserver() {
      if (!activeWidget || !activeWidget.parentElement) return;
      
      // Vi trenger ikke denne funksjonen lenger siden bredden er låst
      // Denne funksjonen kan enten fjernes helt eller tømmes
      log('ResizeObserver ikke brukt - widget bredde er låst');
    }
  })();
