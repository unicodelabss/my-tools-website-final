// Is file ko yahan rakhein: /api/add-tool.js

// Step 1: Zaroori Libraries ko import karna
import { createClient } from '@supabase/supabase-js';
import { Octokit } from '@octokit/rest';
import formidable from 'formidable';
import fs from 'fs';
import jszip from 'jszip';

// Step 2: Vercel ke liye Khaas Config
// Ye Vercel ko batata hai ki body ko khud se parse na kare, taaki 'formidable' library files ko aaram se padh sake.
export const config = {
    api: {
        bodyParser: false,
    },
};

// Step 3: Clients ko Initialize karna (Secret Keys ke saath)
// Ye saari keys Vercel ke Environment Variables se aayengi.

// GitHub se baat karne ke liye client
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const owner = process.env.GITHUB_REPO_OWNER;
const repo = process.env.GITHUB_REPO_NAME;

// Supabase se baat karne ke liye client
// Backend me hamesha 'service_role' key ka istemal hota hai, kyonki ye powerful hoti hai.
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);


// Step 4: Mukhya Handler Function (Jo saara kaam karega)
export default async function handler(req, res) {
    // Sirf POST request ko allow karna
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Galat Method! Sirf POST request allowed hai.' });
    }

    try {
        // Form se data (fields aur files) ko alag-alag karna
        const data = await parseForm(req);
        const { toolName, toolSlug, toolDescription } = data.fields;
        const htmlFile = data.files.htmlFile;
        const zipFile = data.files.zipFile;

        // Tool ke liye naya URL banana
        const toolUrlOnGithub = `tools/${toolSlug}.html`;

        // === KAAM 1: HTML FILE KO GITHUB PAR UPLOAD KARNA ===
        const htmlContent = fs.readFileSync(htmlFile.filepath, 'utf-8');
        await commitFileToGitHub(
            toolUrlOnGithub,
            htmlContent,
            `feat: add new tool - ${toolName}`
        );
        
        // === KAAM 2: (Agar ZIP file hai) ZIP KE ANDAR KI FILES KO GITHUB PAR UPLOAD KARNA ===
        if (zipFile && zipFile.size > 0) {
            const zipBuffer = fs.readFileSync(zipFile.filepath);
            const zip = await jszip.loadAsync(zipBuffer);
            
            // ZIP ke andar har file ke liye
            for (const filename in zip.files) {
                if (!zip.files[filename].dir) { // Agar ye ek file hai, folder nahi
                    const fileContent = await zip.files[filename].async('nodebuffer');
                    // Asset ka path banana
                    const assetPath = `public/assets/${toolSlug}/${filename}`;
                    await commitFileToGitHub(assetPath, fileContent, `feat: add assets for ${toolName}`);
                }
            }
        }
        
        // === KAAM 3: TOOL KI JAANKARI KO SUPABASE DATABASE ME SAVE KARNA ===
        const { error: supabaseError } = await supabase
            .from('tools') // 'tools' table me
            .insert({      // Ye data daal do
                name: toolName, 
                slug: toolSlug,
                description: toolDescription,
                url: `/tools/${toolSlug}.html` // Website par is URL se access hoga
            });

        // Agar database me save karte waqt error aaye to...
        if (supabaseError) {
            throw new Error(`Database Error: ${supabaseError.message}`);
        }

        // Sab safal hone par success message bhejna
        res.status(200).json({ message: 'Tool safaltapoorvak add ho gaya hai!' });

    } catch (error) {
        // Kisi bhi step me error aane par
        console.error('Tool add karne me error:', error);
        res.status(500).json({ message: `Kuch galat ho gaya: ${error.message}` });
    }
}


// Step 5: Helper Functions (Jo mukhya kaam me madad karte hain)

/**
 * Ye function front-end se aaye form data aur files ko alag karta hai.
 */
function parseForm(req) {
    return new Promise((resolve, reject) => {
        const form = formidable({});
        form.parse(req, (err, fields, files) => {
            if (err) return reject(err);
            // Formidable v3 se fields aur files array me aate hain, unhe object me convert kar rahe hain
            const singleFields = {};
            for(const key in fields) { singleFields[key] = fields[key][0]; }
            const singleFiles = {};
            for(const key in files) { singleFiles[key] = files[key][0]; }

            resolve({ fields: singleFields, files: singleFiles });
        });
    });
}

/**
 * Ye function ek file ko GitHub repository me commit karta hai.
 */
async function commitFileToGitHub(path, content, message) {
    // GitHub API ko content Base64 format me chahiye hota hai
    const contentEncoded = Buffer.from(content).toString('base64');
    
    // Check karna ki file pehle se hai ya nahi, taaki use update kar sakein
    let sha;
    try {
        const { data } = await octokit.repos.getContent({ owner, repo, path });
        sha = data.sha; // Agar file hai, to uska SHA mil jayega
    } catch (error) {
        // Agar file nahi hai (404 error), to aage badho. Ye koi problem nahi hai.
        if (error.status !== 404) throw error;
    }
    
    // GitHub par file create ya update karna
    await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,       // File ka path (e.g., tools/my-tool.html)
        message,    // Commit message (e.g., "add new tool")
        content: contentEncoded,
        sha,        // Agar file update ho rahi hai to SHA zaroori hai
    });
}
