import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const project=path.resolve(process.argv[2]||path.resolve(root,'../../..'));
const out=path.resolve(process.argv[3]||path.join(root,'dist'));
fs.mkdirSync(path.join(out,'sources'),{recursive:true});
const records=[]; const sources=new Map();
function source(file){const full=path.join(project,file);const bytes=fs.readFileSync(full);sources.set(file,{path:file,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});return bytes.toString('utf8');}
function number(cell){const m=cell.replaceAll(',','').match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):null;}
function cells(line){return line.split('&').slice(1).map(number);}
function table(name,row){const file=`Paper/Latex/tables/${name}.tex`;const text=source(file);fs.writeFileSync(path.join(out,'sources',`${name}.txt`),text);const lines=text.split(/\r?\n/);const index=lines.findIndex(l=>l.split('&')[0].trim()===row);if(index<0)throw Error(`Missing row ${row}`);const b=cells(lines[index]);const se=cells(lines[index+1]);const obs=lines.find(l=>/^(Observations|N)\s*&/.test(l));const cluster=lines.find(l=>/^(Clusters|Communes|Markets)\s*&/.test(l));return {b,se,n:obs?cells(obs):[],clusters:cluster?cells(cluster):[],source:`sources/${name}.txt`,file};}
function add(t,col,id,label,short,group,description,stars,extra={}){const i=col-1;const b=t.b[i],se=t.se[i];if(!Number.isFinite(b)||!Number.isFinite(se))throw Error(`Invalid source values: ${id}`);records.push({id,label,short,group,b,se,n:t.n[i]??null,clusters:t.clusters[i]??null,description,stars,source:t.source,sourceFile:t.file,sourceColumn:col,...extra});}
const va=table('tab_cohort_va','share\\_priv\\_2m');
add(va,1,'va','Baseline cohort value added','Baseline','cohort','Controls for grade-4 achievement and subject × cohort fixed effects. Weighted by grade-10 tested students; standard errors clustered by commune.',3);
add(va,2,'va-initial','Also control for grade-4 private share','+ Grade-4 share','cohort','Adds the cohort’s grade-4 private share to the baseline specification. Weighted by grade-10 tested students; standard errors clustered by commune.',3);
add(va,3,'va-reading','Reading only','Reading','cohort','Reading outcome with reading baseline achievement and cohort fixed effects. Weighted by grade-10 tested students; standard errors clustered by commune.',3);
add(va,4,'va-math','Math only','Math','cohort','Math outcome with math baseline achievement and cohort fixed effects. Weighted by grade-10 tested students; standard errors clustered by commune.',3);
const tex=source('Paper/Latex/findings.tex');const match=tex.match(/Adding commune fixed effects[^\n]+?yields ([-\d.]+) \(SE \$= ([-\d.]+)\$\)/);if(!match)throw Error('Missing commune FE result');
const excerpt=tex.split(/\r?\n/).filter(l=>l.startsWith('Adding commune fixed effects')).join('\n');fs.writeFileSync(path.join(out,'sources','va_commune_excerpt.txt'),'Manuscript: Cohort Value-Added Evidence / Robustness / Commune fixed effects\n\n'+excerpt+'\n\nObservation and cluster counts are not specified in this paragraph and are not inferred here.');
records.push({id:'va-commune',label:'Cohort value added + commune fixed effects',short:'+ Commune FE',group:'cohort',b:Number(match[1]),se:Number(match[2]),n:null,clusters:null,stars:0,source:'sources/va_commune_excerpt.txt',sourceFile:'Paper/Latex/findings.tex',sourceColumn:null,description:'Adds commune fixed effects to the cohort design. The near-zero estimate is imprecise. This removes persistent differences across communes and uses much less private-share variation. Observation and cluster counts are not reported in the source paragraph.'});
const panel=table('tab_panel_full','share\\_priv');
add(panel,1,'panel','Panel: commune fixed effects','Commune FE','panel','Main panel specification, with commune and grade × subject × year fixed effects. Weighted by tested students; errors clustered by commune.',3);
add(panel,2,'panel-4','Panel: grade 4','Grade 4','panel','Grade-4 sample. Commune and subject × year fixed effects; tested-student weights and commune-clustered standard errors.',0);
add(panel,3,'panel-10','Panel: grade 10','Grade 10','panel','Grade-10 sample. Commune and subject × year fixed effects; tested-student weights and commune-clustered standard errors.',2);
add(panel,4,'panel-reading','Panel: reading','Reading','panel','Reading sample, with commune and grade × year fixed effects. Tested-student weights and commune-clustered standard errors.',3);
add(panel,5,'panel-math','Panel: math','Math','panel','Math sample, with commune and grade × year fixed effects. Tested-student weights and commune-clustered standard errors.',3);
add(panel,6,'panel-strict','Panel: commune × grade fixed effects','Commune × grade FE','panel','Robustness specification replacing commune fixed effects with commune × grade fixed effects. The estimation sample differs by one observation.',2);
const hu=table('tab_hu_benchmark','share\\_priv');
add(hu,1,'ld-4','Long difference: grade 4','Grade 4 · long diff.','gradient','Grade-4 long difference with baseline controls. This is the grade corresponding to Hsieh and Urquiola’s test-score evidence.',0);
add(hu,2,'ld-10','Long difference: grade 10','Grade 10 · long diff.','gradient','Grade-10 long difference with baseline controls. This extends the comparison to a later grade.',2);
const market=table('tab_robust_market','Private share');
add(market,2,'market-panel-gs','Panel: Greater Santiago as one market','Panel · Santiago pooled','market','Main commune-FE panel specification with retained Greater Santiago communes aggregated into one market.',3);
add(market,3,'market-panel-rm','Panel: Metropolitan Region excluded','Panel · excl. Metro','market','Main commune-FE panel specification excluding the Metropolitan Region.',3);
add(market,4,'market-va-gs','Cohort VA: Greater Santiago as one market','VA · Santiago pooled','market','Cohort value added with retained Greater Santiago communes aggregated into one market.',3);
add(market,5,'market-va-rm','Cohort VA: Metropolitan Region excluded','VA · excl. Metro','market','Cohort value added excluding the Metropolitan Region.',3);
add(table('tab_exposure','PS share, grade 4'),1,'exposure-4','Exposure measured at grade 4','Grade 4 share','exposure','Private share at grade 4, controlling for baseline achievement and subject × cohort fixed effects. Common sample; grade-10 tested-student weights and commune-clustered errors.',3);
add(table('tab_exposure','Exposure, grades 5--10'),2,'exposure-510','Average exposure in grades 5–10','Grades 5–10 average','exposure','Average annual private share over grades 5–10. Same baseline control, weights, fixed effects, and common sample.',3);
add(table('tab_exposure','Exposure, grades 5--9'),4,'exposure-59','Average exposure in grades 5–9','Grades 5–9 average','exposure','Average private share over grades 5–9, measured entirely before the outcome year. Same baseline control, weights, fixed effects, and common sample.',3);
add(table('tab_exposure','PS share, grade 10'),5,'exposure-10','Exposure measured at grade 10','Grade 10 share','exposure','Endpoint private share. Same baseline control, weights, fixed effects, and common sample. This table rounds the baseline standard error to 2.47.',3);
const payload={snapshot:'2026-09-16',status:'Reported manuscript results; not newly estimated',uncertainty:'Displayed intervals are coefficient ± one reported standard error, not confidence intervals.',records};
fs.writeFileSync(path.join(out,'results.js'),'window.CHILE_RESULTS = '+JSON.stringify(payload,null,2)+';\n');
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(payload,null,2));
const fields=['id','label','b','se','n','clusters','stars','description','sourceFile','sourceColumn'];const csv=val=>'"'+String(val??'').replaceAll('"','""')+'"';
fs.writeFileSync(path.join(out,'results.csv'),[fields.join(','),...records.map(r=>fields.map(k=>csv(r[k])).join(','))].join('\r\n'));
const pdf=fs.readFileSync(path.join(project,'Paper/Latex/findings.pdf'));fs.writeFileSync(path.join(out,'paper.pdf'),pdf);sources.set('Paper/Latex/findings.pdf',{path:'Paper/Latex/findings.pdf',sha256:crypto.createHash('sha256').update(pdf).digest('hex'),note:'Existing supplied PDF. Its build predates the last saved LaTeX source; displayed estimates are extracted from source tables/text.'});
fs.writeFileSync(path.join(out,'sources/provenance.json'),JSON.stringify({snapshot:payload.snapshot,status:payload.status,uncertainty:payload.uncertainty,files:[...sources.values()]},null,2));
console.log(`Exported ${records.length} source-backed estimates.`);
