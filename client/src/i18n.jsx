import { createContext, useContext } from "react";

export const LANGS = [["en", "English"], ["kn", "ಕನ್ನಡ"], ["hi", "हिन्दी"]];
const D = {
  en: { profile: "Profile", vitals: "Health readings", patients: "My patients", users: "People", visits: "All visits", book: "Book visit", reminders: "Reminders", records: "Records", symptoms: "Symptoms", chat: "Chat", emergency: "Emergency",
    appointments: "Appointments", insights: "Insights", login: "Log in", register: "Create account", logout: "Log out", email: "Email",
    password: "Password", name: "Full name", forgot: "Forgot password?", send: "Send", confirm: "Confirm appointment", pay: "Pay",
    cancel: "Cancel", myVisits: "My appointments", newHere: "New here? Create an account", haveAcc: "Have an account? Log in",
    sendLink: "Send reset link", setPass: "Save new password", newPass: "New password" },
  kn: { profile: "ಪ್ರೊಫೈಲ್", vitals: "ಆರೋಗ್ಯ ಅಳತೆಗಳು", patients: "ನನ್ನ ರೋಗಿಗಳು", users: "ಜನರು", visits: "ಎಲ್ಲಾ ಭೇಟಿಗಳು", book: "ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್", reminders: "ಔಷಧಿ ನೆನಪು", records: "ಆರೋಗ್ಯ ದಾಖಲೆಗಳು", symptoms: "ಲಕ್ಷಣ ಪರಿಶೀಲನೆ", chat: "ಚಾಟ್", emergency: "ತುರ್ತು",
    appointments: "ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್‌ಗಳು", insights: "ಅಂಕಿಅಂಶ", login: "ಲಾಗಿನ್", register: "ಖಾತೆ ರಚಿಸಿ", logout: "ಲಾಗ್ ಔಟ್", email: "ಇಮೇಲ್",
    password: "ಪಾಸ್‌ವರ್ಡ್", name: "ಪೂರ್ಣ ಹೆಸರು", forgot: "ಪಾಸ್‌ವರ್ಡ್ ಮರೆತಿರುವಿರಾ?", send: "ಕಳುಹಿಸಿ", confirm: "ಖಚಿತಪಡಿಸಿ", pay: "ಪಾವತಿಸಿ",
    cancel: "ರದ್ದುಮಾಡಿ", myVisits: "ನನ್ನ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್‌ಗಳು", newHere: "ಹೊಸಬರೇ? ಖಾತೆ ರಚಿಸಿ", haveAcc: "ಖಾತೆ ಇದೆಯೇ? ಲಾಗಿನ್ ಮಾಡಿ",
    sendLink: "ರೀಸೆಟ್ ಲಿಂಕ್ ಕಳುಹಿಸಿ", setPass: "ಹೊಸ ಪಾಸ್‌ವರ್ಡ್ ಉಳಿಸಿ", newPass: "ಹೊಸ ಪಾಸ್‌ವರ್ಡ್" },
  hi: { profile: "प्रोफ़ाइल", vitals: "स्वास्थ्य माप", patients: "मेरे मरीज़", users: "लोग", visits: "सभी विज़िट", book: "अपॉइंटमेंट", reminders: "दवा रिमाइंडर", records: "स्वास्थ्य रिकॉर्ड", symptoms: "लक्षण जाँच", chat: "चैट", emergency: "आपातकाल",
    appointments: "अपॉइंटमेंट", insights: "आँकड़े", login: "लॉग इन", register: "खाता बनाएँ", logout: "लॉग आउट", email: "ईमेल",
    password: "पासवर्ड", name: "पूरा नाम", forgot: "पासवर्ड भूल गए?", send: "भेजें", confirm: "पुष्टि करें", pay: "भुगतान करें",
    cancel: "रद्द करें", myVisits: "मेरी अपॉइंटमेंट", newHere: "नए हैं? खाता बनाएँ", haveAcc: "खाता है? लॉग इन करें",
    sendLink: "रीसेट लिंक भेजें", setPass: "नया पासवर्ड सहेजें", newPass: "नया पासवर्ड" },
};
export const LangCtx = createContext({ lang: "en" });
export const useT = () => { const { lang } = useContext(LangCtx); return (k) => (D[lang] && D[lang][k]) || D.en[k] || k; };
