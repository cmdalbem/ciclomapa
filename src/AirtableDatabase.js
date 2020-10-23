const AIRTABLE_API_KEY = process.env.REACT_APP_AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = 'appcabRJEC9bAxSin';

const debugStyles = {
    blue: 'color: lightblue;',
    gray: 'color: gray;',
    important: 'font-size: 1.2em;',
}

class AirtableDatabase {
    async fetchTable(tableName, view, offset, accumulator=[]) {
        console.debug('AIRTABLE_API_KEY', AIRTABLE_API_KEY);

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

    async post(tableName, data) {
        let queryUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableName}?api_key=${AIRTABLE_API_KEY}`;

        console.debug('data', data);

        const response = await fetch(queryUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        }).then(res => {
            console.log("Request complete! response:", res);
        });
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

    async create(fields) {
        return await this.post('Comments', { records: [{fields}] });
    }
}

export default AirtableDatabase;