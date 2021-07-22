const AIRTABLE_API_KEY = process.env.REACT_APP_AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.REACT_APP_AIRTABLE_BASE_ID;

const COMMENTS_TABLE_NAME = 'Comments';
const METADATA_TABLE_NAME = 'Metadata';

const TAGS_LIST_COMMENT_ID = 44;

const debugStyles = {
    blue: 'color: lightblue;',
    gray: 'color: gray;',
    important: 'font-size: 1.2em;',
}

class AirtableDatabase {
    async fetchTable(tableName, view, offset, accumulator=[]) {
        if (!AIRTABLE_API_KEY) {
            console.error('No AIRTABLE_API_KEY!');
            return;
        }

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

        await fetch(queryUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        }).then(res => {
            console.log("Request complete! response:", res);
        });
    }

    async getComments() {
        let comments = await this.fetchTable(COMMENTS_TABLE_NAME);
        
        if (comments) {
            // This special comment has a list of all possible tags
            const tagsListComment = comments.filter(c => c.fields.id === TAGS_LIST_COMMENT_ID)[0];

            if (tagsListComment) {
                const tagsList = tagsListComment.fields.tags;
                
                // Filter out solved comments
                // @todo filter them when fetching the table, to improve performance
                comments = comments.filter(c => c.fields.status !== 'Resolvida');
                
                // Ignore if there are comments without latlong
                comments = comments.filter(c => c.fields.latlong !== undefined);

                return {
                    comments,
                    tagsList
                }
            } else {
                console.error('getComments(): Error retrieving tags list');
            }
        }
    }

    async getMetadata(city) {
        return await this.fetchTable(METADATA_TABLE_NAME);
    }

    async create(fields) {
        return await this.post(COMMENTS_TABLE_NAME, { records: [{fields}] });
    }
}

export default AirtableDatabase;