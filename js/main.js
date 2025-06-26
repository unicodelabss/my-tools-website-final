document.addEventListener('DOMContentLoaded', () => {

    const preloader = document.getElementById('preloader');
    const heroContent = document.querySelector('.hero-text-content');
    const mainContent = document.querySelector('main');
    const toolGridSection = document.getElementById('tools');
    const toolWorkspace = document.getElementById('tool-workspace');
    const toolContainer = document.getElementById('tool-container');
    const backToGridBtn = document.getElementById('back-to-grid');
    const toolCards = document.querySelectorAll('.tool-card');

    // 1. प्री-लोडर को छिपाना
    window.addEventListener('load', () => {
        preloader.style.opacity = '0';
        setTimeout(() => {
            preloader.style.display = 'none';
        }, 500);
    });

    // 2. हीरो सेक्शन में माउस मूवमेंट 3D इफ़ेक्ट
    document.body.addEventListener('mousemove', (e) => {
        if (window.innerWidth < 768) return; // मोबाइल पर डिसेबल करें
        const { clientX, clientY } = e;
        const { innerWidth, innerHeight } = window;
        
        const rotX = (clientY / innerHeight - 0.5) * -30; // Y-axis rotation
        const rotY = (clientX / innerWidth - 0.5) * 30; // X-axis rotation
        
        heroContent.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    });

    // 3. स्क्रॉल पर एलिमेंट्स को एनिमेट करना
    const scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                scrollObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.animate-on-scroll').forEach(el => {
        scrollObserver.observe(el);
    });

    // 4. टूल लोडिंग लॉजिक (SPA जैसा व्यवहार)
    toolCards.forEach(card => {
        card.addEventListener('click', async () => {
            const toolName = card.dataset.tool;
            if (!toolName) return;

            // लोडर दिखाएं और ग्रिड छिपाएं
            preloader.style.display = 'flex';
            preloader.style.opacity = '1';
            toolGridSection.classList.add('hidden');
            
            try {
                // संबंधित टूल की HTML फ़ाइल को Fetch करें
                const response = await fetch(`tools/${toolName}.html`);
                if (!response.ok) throw new Error('Tool not found');
                
                const toolHtml = await response.text();
                
                // टूल का HTML वर्कस्पेस में इंजेक्ट करें
                toolContainer.innerHTML = toolHtml;
                
                // वर्कस्पेस दिखाएं
                toolWorkspace.classList.remove('hidden');
                window.scrollTo({ top: toolWorkspace.offsetTop - 150, behavior: 'smooth' });

                // इंजेक्ट किए गए HTML में मौजूद स्क्रिप्ट को चलाएं
                const scripts = toolContainer.querySelectorAll('script');
                scripts.forEach(script => {
                    const newScript = document.createElement('script');
                    newScript.text = script.innerText;
                    // अगर स्क्रिप्ट में src है, तो उसे भी हैंडल करें
                    if(script.src) {
                        newScript.src = script.src;
                    }
                    document.body.appendChild(newScript).parentNode.removeChild(newScript);
                });

            } catch (error) {
                console.error('Error loading tool:', error);
                toolContainer.innerHTML = `<p style="color:red;">Error: ${error.message}. Please try again later.</p>`;
                toolWorkspace.classList.remove('hidden');
            } finally {
                // लोडर छिपाएं
                setTimeout(() => {
                    preloader.style.opacity = '0';
                    setTimeout(() => preloader.style.display = 'none', 500);
                }, 300); // थोड़ा डिले ताकि स्मूद लगे
            }
        });
    });

    // 5. "वापस जाएं" बटन का लॉजिक
    backToGridBtn.addEventListener('click', () => {
        toolWorkspace.classList.add('hidden');
        toolGridSection.classList.remove('hidden');
        toolContainer.innerHTML = ''; // वर्कस्पेस को साफ़ करें
        window.scrollTo({ top: toolGridSection.offsetTop - 150, behavior: 'smooth' });
    });
});