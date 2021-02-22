class Analytics {
    static gtag() {
        if (window.dataLayer) {
            window.dataLayer.push(arguments);
        }
    }

    static event(name, opts={})  {
        this.gtag('event', name, opts);
        console.debug(`this.gtag('event', ${name}, ...);`, opts);
    }

    static setUserProperty(opts={}) {
        this.gtag('set', 'user_properties', opts);
    }
}

export default Analytics;