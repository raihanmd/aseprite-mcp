local function run()
  local operations=dofile('extension/operations.lua')
  local source=operations.create_sprite{width=8,height=8,name='Component art'}
  local sourceId=source.documentId
  local sourceLayerId=source.layers[1].layerId
  local group=operations.create_group{documentId=sourceId,name='Body'}
  local sourceSprite=app.sprite
  local groupLayer=sourceSprite.layers[2]
  sourceSprite.layers[1].parent=groupLayer
  local nested=operations.create_group{documentId=sourceId,name='Face',parentGroupId=group.groupId}
  local nestedLayer
  for _,layer in ipairs(groupLayer.layers) do if layer.name=='Face' then nestedLayer=layer end end
  assert(nestedLayer)
  local face=sourceSprite:newLayer();face.name='Eyes';face.parent=nestedLayer
  operations.draw_pixels{documentId=sourceId,layerId=sourceLayerId,frame=1,label='Body mark',pixels={{x=1,y=1,rgba={80,150,220,255},expected={0,0,0,0}}}}
  source=operations.get_document_info{documentId=sourceId}
  local eyeId
  for _,layer in ipairs(source.layers) do if layer.name=='Eyes' then eyeId=layer.layerId end end
  assert(eyeId and nested.groupId)
  operations.draw_pixels{documentId=sourceId,layerId=eyeId,frame=1,label='Eye mark',pixels={{x=3,y=2,rgba={250,220,80,255}}}}
  operations.duplicate_frame{documentId=sourceId,sourceFrame=1}
  operations.set_frame_duration{documentId=sourceId,frame=2,durationMs=160}
  operations.move_cel{documentId=sourceId,layerId=eyeId,frame=2,dx=1,dy=0,allowOffCanvas=false}
  local sourceArt
  for _,layer in ipairs(groupLayer.layers) do if layer.name=='Component art' then sourceArt=layer end end
  assert(sourceArt)
  sourceArt.opacity=190
  nestedLayer.isEditable=false
  local sourceBefore=operations.get_document_info{documentId=sourceId}
  local sourcePreviewBefore=operations.get_preview{documentId=sourceId,frame=2}.rgbaHex
  local target=operations.create_sprite{width=16,height=16,name='Master'}
  local targetId=target.documentId
  operations.add_frame{documentId=targetId,durationMs=160}
  local host=operations.create_group{documentId=targetId,name='Actors'}
  local before=operations.get_document_info{documentId=targetId}
  operations.set_frame_duration{documentId=targetId,frame=2,durationMs=120}
  local timingOk,timingError=pcall(operations.import_component,{documentId=targetId,sourceDocumentId=sourceId,groupName='Timing probe',allowOffCanvas=false,timingPolicy='require_match'})
  assert(not timingOk and timingError.code=='TIMING_MISMATCH')
  operations.set_frame_duration{documentId=targetId,frame=2,durationMs=160}
  local canvasOk,canvasError=pcall(operations.import_component,{documentId=targetId,sourceDocumentId=sourceId,groupName='Canvas probe',x=12,allowOffCanvas=false,timingPolicy='require_match'})
  assert(not canvasOk and canvasError.code=='OUTSIDE_CANVAS')
  local selfOk,selfError=pcall(operations.import_component,{documentId=targetId,sourceDocumentId=targetId,groupName='Self probe',allowOffCanvas=false,timingPolicy='require_match'})
  assert(not selfOk and selfError.code=='INVALID_ARGUMENT')
  assert(#operations.get_document_info{documentId=targetId}.layers==#before.layers)
  -- Import must belong to the target undo stack even when another tab is active.
  app.sprite=sourceSprite
  local imported=operations.import_component{documentId=targetId,sourceDocumentId=sourceId,parentGroupId=host.groupId,groupName='Hero',x=2,y=3,allowOffCanvas=false,timingPolicy='require_match'}
  assert(app.sprite==sourceSprite)
  assert(imported.layerCount==4 and imported.celCount==4 and imported.independentCels)
  local after=operations.get_document_info{documentId=targetId}
  assert(#after.frames==#before.frames and #after.layers==#before.layers+5)
  assert(after.frames[2].durationMs==160)
  local hero,body,art,faceGroup,eyes
  for _,layer in ipairs(after.layers) do
    if layer.layerId==imported.groupId then hero=layer end
    if layer.name=='Body' and layer.parentLayerId==imported.groupId then body=layer end
    if layer.name=='Component art' then art=layer end
    if layer.name=='Face' then faceGroup=layer end
    if layer.name=='Eyes' then eyes=layer end
  end
  assert(hero and hero.parentLayerId==host.groupId and body and art and faceGroup and eyes)
  assert(art.parentLayerId==body.layerId)
  assert(art.opacity==190 and faceGroup.editable==false and eyes.parentLayerId==faceGroup.layerId)
  assert(art.stackIndex==sourceBefore.layers[2].stackIndex)
  local bodyPixel=operations.read_pixels{documentId=targetId,layerId=art.layerId,frame=1,x=3,y=4,width=1,height=1}.pixels[1]
  assert(bodyPixel.rgba[3]==220)
  local sourceAfter=operations.get_document_info{documentId=sourceId}
  assert(#sourceAfter.layers==#sourceBefore.layers and #sourceAfter.cels==#sourceBefore.cels)
  assert(operations.get_preview{documentId=sourceId,frame=2}.rgbaHex==sourcePreviewBefore)
  local same,reason=pcall(operations.import_component,{documentId=targetId,sourceDocumentId=sourceId,groupName='Hero',parentGroupId=host.groupId,x=0,y=0,allowOffCanvas=false,timingPolicy='require_match'})
  assert(not same and reason.code=='LAYER_EXISTS')
  local diff=operations.compare_frames{documentId=targetId,previousFrame=1,currentFrame=2}
  assert(diff.width==16 and diff.height==16 and #diff.rgbaHex==16*16*8 and diff.changedPixels==2)
  local onion=operations.render_onion_skin{documentId=targetId,previousFrame=1,currentFrame=2}
  assert(onion.width==16 and #onion.rgbaHex==16*16*8)
  operations.undo{documentId=targetId}
  local undone=operations.get_document_info{documentId=targetId}
  assert(#undone.layers==#before.layers)
  operations.redo{documentId=targetId}
  assert(#operations.get_document_info{documentId=targetId}.layers==#after.layers)
  operations.set_frame_duration{documentId=targetId,frame=2,durationMs=120}
  local kept=operations.import_component{documentId=targetId,sourceDocumentId=sourceId,groupName='Alternate timing',x=2,y=3,allowOffCanvas=false,timingPolicy='keep_target'}
  assert(kept.timingPolicy=='keep_target' and kept.frameMap[2].sourceDurationMs==160 and kept.frameMap[2].targetDurationMs==120)
  assert(operations.get_document_info{documentId=targetId}.frames[2].durationMs==120)
  local static=operations.create_sprite{width=4,height=4,name='Static prop'}
  operations.draw_pixels{documentId=static.documentId,layerId=static.layers[1].layerId,frame=1,label='Prop mark',pixels={{x=1,y=1,rgba={35,200,80,255},expected={0,0,0,0}}}}
  local held=operations.import_component{documentId=targetId,sourceDocumentId=static.documentId,groupName='Held prop',allowOffCanvas=false,timingPolicy='require_match',frameMap={{sourceFrame=1,targetFrame=1},{sourceFrame=1,targetFrame=2}}}
  assert(held.celCount==2 and held.frameMap[2].sourceFrame==1)
  assert(operations.get_document_info{documentId=targetId}.frames[2].durationMs==120)
  local final=operations.get_document_info{documentId=targetId}
  local frameOne=operations.get_preview{documentId=targetId,frame=1}.rgbaHex
  local frameTwo=operations.get_preview{documentId=targetId,frame=2}.rgbaHex
  local outputPath=assert(app.params.outputPath)
  operations.save_copy{documentId=targetId,stagingPath=outputPath}
  local reopened=operations.open_document{inputPath=outputPath}
  assert(#reopened.layers==#final.layers and #reopened.cels==#final.cels and #reopened.frames==2)
  for index,layer in ipairs(final.layers) do
    local saved=reopened.layers[index]
    assert(saved.name==layer.name and saved.group==layer.group and saved.stackIndex==layer.stackIndex)
  end
  assert(operations.get_preview{documentId=reopened.documentId,frame=1}.rgbaHex==frameOne)
  assert(operations.get_preview{documentId=reopened.documentId,frame=2}.rgbaHex==frameTwo)
  print('Real Aseprite component operations passed')
end
local ok,problem=pcall(run)
if not ok then
  if type(problem)=='table' then print((problem.code or 'UNKNOWN')..': '..(problem.message or 'no message'))
  else print(tostring(problem)) end
  error('Real Aseprite component operations failed')
end
