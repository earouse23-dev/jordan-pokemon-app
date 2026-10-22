import test from "node:test";
import assert from "node:assert/strict";
import { cardPriceHistoryWindow, displayHistoryCurrency, completedSalePriceHistory } from "../lib/price-history.js";
test("history ranges reject false dates and prices and count distinct days", () => {
  const now = Date.parse("2026-09-06T12:00:00Z");
  const rows = [
    ["2026-09-05", 10],
    ["2026-09-05T12:00:00Z", 20],
    ["2026-08-01", 900],
    ["2026-09-07", 900],
    ["2026-02-30", 900],
    ["2026-09-04", null],
  ].map(([recordedAt, amount]) => ({ recordedAt, amount, currency: "USD" }));
  const model = cardPriceHistoryWindow({ currency: "USD" }, rows, "1w", now);
  assert.equal(model.points.length, 2);
  assert.equal(model.summary.days, 1);
  assert.equal(model.summary.average, 15);
  assert.equal(
    cardPriceHistoryWindow({ currency: "USD" }, rows, "1d", now).points.length,
    1,
  );
});
test("purchase markers exclude unknown costs, foreign currency and dates outside the chosen window", () => {
  const purchase = {
    type: "purchase",
    date: "2026-09-05",
    totalCost: 40,
    quantity: 2,
    currency: "USD",
  };
  const model = cardPriceHistoryWindow(
    {
      currency: "USD",
      transactions: [
        purchase,
        { ...purchase, costBasisKnown: false },
        { ...purchase, currency: "EUR" },
        { ...purchase, date: "2020-01-01" },
        { ...purchase, totalCost: null },
      ],
    },
    [],
    "1w",
    Date.parse("2026-09-06"),
  );
  assert.equal(model.purchases.length, 1);
  assert.equal(model.purchases[0].y, 20);
  assert.equal(model.basis, null);
});

test("six-month item range excludes older and foreign-currency prices without filling gaps", () => {
  const now=Date.parse("2026-10-03T12:00:00Z");
  const history=[
    {recordedAt:"2026-06-01",amount:100,currency:"EUR"},
    {recordedAt:"2026-03-01",amount:200,currency:"EUR"},
    {recordedAt:"2026-06-02",amount:300,currency:"USD"},
  ];
  const result=cardPriceHistoryWindow({currency:"EUR"},history,"6m",now);
  assert.equal(result.range,"6m");
  assert.deepEqual(result.points.map(point=>point.amount),[100]);
});

test("chart display conversion preserves native observations, dates and transaction facts", () => {
 const now = Date.parse("2026-10-03T12:00:00Z"); const hash = "a".repeat(64);
 const rate = {sourceId:"ecb-eurofxref-daily",sourceUrl:"https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml",base:"EUR",quote:"USD",units:"USD per EUR",rate:1.25,effectiveDate:"2026-10-02",fetchedAt:"2026-10-03T00:00:00.000Z",contentSha256:hash,rateRef:"ecb-eurofxref-daily:2026-10-02:"+hash};
 const model = cardPriceHistoryWindow({currency:"USD",quantity:1,costBasis:100,transactions:[{type:"purchase",date:"2026-09-01",currency:"USD",totalCost:100,quantity:1}]},[{recordedAt:"2026-09-01",amount:150,currency:"USD"},{recordedAt:"2026-10-01",amount:100,currency:"USD"}],"all",now);
 const original = structuredClone(model); const eur = displayHistoryCurrency(model,"EUR",rate,now);
 assert.deepEqual(eur.points.map(p=>p.amount),[120,80]); assert.equal(eur.summary.change,-40); assert.equal(eur.basis,80);
 assert.equal(eur.points[0].nativeAmount,150); assert.equal(eur.points[0].recordedAt,"2026-09-01"); assert.equal(eur.purchases[0].y,80); assert.equal(eur.purchases[0].transaction.totalCost,100); assert.equal(eur.rateRef,rate.rateRef);
 assert.deepEqual(model,original);
 const withSales={...model,observations:[{amount:150,currency:'USD',recordedAt:'2026-09-01',providerVariantId:'ebay:one'}]};
 const convertedSales=displayHistoryCurrency(withSales,'EUR',rate,now).observations;
 assert.equal(convertedSales[0].amount,120);assert.equal(convertedSales[0].nativeAmount,150);assert.equal(convertedSales[0].providerVariantId,'ebay:one');

 const unavailable=displayHistoryCurrency(model,"EUR",null,now); assert.equal(unavailable.conversionUnavailable,true); assert.equal(unavailable.currency,"USD"); assert.deepEqual(unavailable.points.map(p=>p.amount),[150,100]); assert.equal(unavailable.basis,model.basis); assert.deepEqual(unavailable.summary,model.summary); assert.deepEqual(unavailable.purchases,model.purchases);
 assert.deepEqual(displayHistoryCurrency(model,"USD",null,now).points.map(p=>p.amount),[150,100]);
});

test('all-time card chart fits recorded sales instead of an earlier purchase or today', () => {
 const result = cardPriceHistoryWindow({currency:'USD',transactions:[{type:'purchase',date:'2025-03-12',currency:'USD',totalCost:250,quantity:1}]},[{recordedAt:'2026-08-01',amount:1000,currency:'USD'},{recordedAt:'2026-08-31',amount:950,currency:'USD'}],'all',Date.parse('2026-10-10'));
 assert.equal(result.start,Date.parse('2026-08-01'));assert.equal(result.end,Date.parse('2026-08-31'));
 assert.equal(result.purchases.length,1,'ownership evidence remains available');
 const single=cardPriceHistoryWindow({currency:'USD'},[{recordedAt:'2026-08-31',amount:950,currency:'USD'}],'all',Date.parse('2026-10-10'));
 assert.equal(single.end-single.start,86400000);
});


test("daily sale history is order-independent, revision-aware and preserves every transaction", () => {
 const amounts=[4150,4900,4200,5000,4600,4900,3800,3900,3850,3750];
 const evidence=amounts.map((amount,index)=>({transactionKey:'ebay:'+index,soldAt:index<6?'2026-07-20':'2026-09-27',amount,currency:'USD',sourceUrl:'https://www.ebay.com/itm/'+index,saleType:null}));
 const result={evidence,eligibleEvidenceIds:evidence.map(p=>p.transactionKey)};
 const derived=completedSalePriceHistory(result);
 assert.deepEqual(derived.points.map(p=>[p.amount,p.saleCount,p.low,p.high]),[[4750,6,4150,5000],[3825,4,3750,3900]]);
 assert.deepEqual(completedSalePriceHistory({...result,evidence:[...evidence].reverse()}),derived);
 assert.equal(completedSalePriceHistory(result,derived),derived);
 const changed=completedSalePriceHistory({...result,evidence:evidence.map((p,i)=>i===9?{...p,amount:4000}:p)},derived);
 assert.notEqual(changed.sourceKey,derived.sourceKey);assert.equal(changed.points[1].amount,3875);
 const model=cardPriceHistoryWindow({currency:'USD'},derived.points,'all',Date.parse('2026-10-22'));
 assert.equal(model.summary.change,-925);assert.equal(model.observations.length,10);
 assert.equal(new Set(model.points.map(p=>p.x)).size,model.points.length);
 assert.equal(model.observations.filter(p=>p.provider==='eBay reported comp').length,10);
 assert.equal(completedSalePriceHistory({...result,eligibleEvidenceIds:[]}).points.length,0);
 const midnight=completedSalePriceHistory({evidence:[{...evidence[0],soldAt:'2026-09-26T23:30:00-02:00'}],eligibleEvidenceIds:[evidence[0].transactionKey]});
 assert.equal(midnight.points[0].recordedAt,'2026-09-27T00:00:00Z');

 assert.deepEqual(JSON.parse(JSON.stringify(derived)),derived,'derived history is persistable with retained evidence');
 const separated=completedSalePriceHistory({evidence:[...evidence,{...evidence[0],transactionKey:'ebay:eur',currency:'EUR',amount:999}],eligibleEvidenceIds:[...result.eligibleEvidenceIds,'ebay:eur']});
 assert.equal(separated.points.length,3);assert.equal(separated.points.find(p=>p.currency==='EUR').amount,999);
 const sparse=cardPriceHistoryWindow({currency:'USD'},derived.points,'1m',Date.parse('2026-10-22'));
 assert.equal(sparse.points.length,1);assert.equal(sparse.summary.change,null);assert.equal(sparse.observations.length,4);
});
