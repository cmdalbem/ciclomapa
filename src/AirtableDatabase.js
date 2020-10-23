const AIRTABLE_API_KEY = 'keyitXI1MaCb75MYj';
const AIRTABLE_BASE_ID = 'appcabRJEC9bAxSin';

const debugStyles = {
    blue: 'color: lightblue;',
    gray: 'color: gray;',
    important: 'font-size: 1.2em;',
}

class AirtableDatabase {
    async fetchTable(tableName, view, offset, accumulator=[]) {
        let queryUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableName}?api_key=${AIRTABLE_API_KEY}`;
        if (view) {
            queryUrl += `&view=${view}`;
        }

        if (offset) {
            queryUrl += `&offset=${offset}`;
        }
         
        const response = await fetch(queryUrl);
        const data = await response.json();
        
        if (data.records && data.records.length > 0) {
            let accumulated = data.records;
    
            accumulated = accumulated.concat(accumulator);
    
            if (data.offset) {
                console.debug(`%cfetchTable(${tableName}/${view}): offset detected, recursing...`, debugStyles.blue);
                return this.fetchTable(tableName, view, data.offset, accumulated);
            } else {
                console.debug(`%cfetchTable(${tableName}/${view}): end of pagination, returning.`, debugStyles.blue);
                return accumulated;
            }
        } else {
            console.warn(`%cfetchTable(${tableName}/${view}): zero records`, debugStyles.blue);
        }
    }

    async get() {
        let data;

        // Query comments
        data = await this.fetchTable('Comments');
        if (data && data.length > 0) {
            // data.forEach(record => {
            //     this.data[record.id] = record;
            //     this.data[record.id].videos = [];
            // });
            console.debug('data', data);
        } else {
            console.error('No data from Airtable.')
        };

        return data;
    }
}

export default AirtableDatabase;