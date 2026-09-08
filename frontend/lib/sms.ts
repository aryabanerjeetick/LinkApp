export interface SmsConfig {
    accountSid: string;
    authToken: string;
    fromNumber: string;
}

/**
 * Sends a real SMS using the Twilio REST API directly from the client.
 * NOTE: In a true production environment, this MUST be done on a backend server 
 * to protect the Auth Token. This is implemented client-side here to allow 
 * the user to test real SMS delivery in this serverless preview environment.
 */
export const sendRealSMS = async (to: string, body: string, config: SmsConfig) => {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
    
    const params = new URLSearchParams();
    params.append('To', to);
    params.append('From', config.fromNumber);
    params.append('Body', body);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + btoa(`${config.accountSid}:${config.authToken}`),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to send SMS via Twilio');
    }
    
    return response.json();
};
