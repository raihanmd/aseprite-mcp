-- Run with the installed Aseprite CLI; this checks actual Lua API behavior.
local function run()
local operations=dofile('extension/operations.lua')
operations.attach_art(dofile('extension/art_operations.lua'))
local sprite=Sprite(8,8,ColorMode.RGB)
app.sprite=sprite
local documentId=operations.list_documents().documents[1].documentId
local layerId=operations.get_document_info{documentId=documentId}.layers[1].layerId
operations.draw_pixels{
  documentId=documentId,layerId=layerId,frame=1,label='Animation API probe',
  pixels={{x=1,y=2,rgba={230,80,40,255},expected={0,0,0,0}}}
}
operations.set_frame_duration{documentId=documentId,frame=1,durationMs=175}
local duplicated=operations.duplicate_frame{documentId=documentId,sourceFrame=1}
assert(#duplicated.frames==2 and duplicated.frames[2].durationMs==175)
assert(#duplicated.cels==2 and duplicated.cels[1].linked==false and duplicated.cels[2].linked==false)
local rejected,reason=pcall(operations.move_cel,{documentId=documentId,layerId=layerId,frame=2,dx=1,dy=0,allowOffCanvas=false})
assert(not rejected and reason.code=='OUTSIDE_CANVAS')
local moved=operations.move_cel{documentId=documentId,layerId=layerId,frame=2,dx=1,dy=0,allowOffCanvas=true}
assert(moved.x==1)
local before=operations.read_pixels{documentId=documentId,layerId=layerId,frame=1,x=1,y=2,width=2,height=1}.pixels
local after=operations.read_pixels{documentId=documentId,layerId=layerId,frame=2,x=1,y=2,width=2,height=1}.pixels
assert(before[1].rgba[1]==230 and before[2].rgba[4]==0)
assert(after[1].rgba[4]==0 and after[2].rgba[1]==230)
operations.add_frame{documentId=documentId,durationMs=120}
assert(operations.copy_cel{documentId=documentId,layerId=layerId,sourceFrame=1,targetFrame=3}.independent)
local copied=operations.get_document_info{documentId=documentId}
assert(#copied.cels==3 and copied.cels[3].linked==false)
print('Real Aseprite animation operations passed')
end
local ok,problem=pcall(run)
if not ok then
  if type(problem)=='table' then print((problem.code or 'UNKNOWN')..': '..(problem.message or 'no message'))
  else print(tostring(problem)) end
  error('Real Aseprite animation operations failed')
end
